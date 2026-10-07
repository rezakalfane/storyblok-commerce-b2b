import { renderRichText } from "@storyblok/richtext";
import type { Tags } from "@/core/edit";
import type { Locale } from "@/lib/i18n";

const HOSTS: Record<string, string> = { eu: "api.storyblok.com", us: "api-us.storyblok.com", ca: "api-ca.storyblok.com", ap: "api-ap.storyblok.com" };
const HOST = HOSTS[(process.env.STORYBLOK_REGION ?? "eu").trim().toLowerCase()] ?? HOSTS.eu;
export const SPACE_ID = process.env.STORYBLOK_SPACE_ID ?? "";
const PREVIEW_TOKEN = process.env.STORYBLOK_PREVIEW_TOKEN ?? "";
/** Published content is read with the public token when there is one (it cannot read drafts at all). */
const PUBLIC_TOKEN = process.env.STORYBLOK_PUBLIC_TOKEN || PREVIEW_TOKEN;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Blok = Record<string, any>;
export type Story = { id: number; uuid: string; name: string; slug: string; full_slug: string; content: Blok };
/** What a read returns: the stories and the related stories (`rels`) their relation fields point at, by uuid. */
export type Read<T> = { data: T; rels: Map<string, Story> };

/** `default` is the language without a suffix; French values are `field__i18n__fr`, which the Delivery API merges when `language=fr`. */
const LANGUAGE: Record<Locale, string | undefined> = { en: undefined, fr: "fr" };

// ---------------------------------------------------------------- unsaved edits (Visual Editor bridge)
const LIVE_TTL_MS = 5 * 60_000;
const live = (globalThis as { __sbLive?: Map<number, { story: Story; at: number }> }).__sbLive ?? new Map();
(globalThis as { __sbLive?: typeof live }).__sbLive = live;

/** Keeps the unsaved story the Visual Editor sent (the whole story, every change), for a few minutes. Only read for drafts. */
export function setLiveStory(story: Story) {
  if (live.size >= 100) live.delete(live.keys().next().value as number);
  live.set(story.id, { story, at: Date.now() });
}
export const clearLiveStories = () => live.clear();

/** Copies `field__i18n__<lang>` values over `field` (the bridge sends every language next to the default value). */
function applyLanguage<T>(node: T, lang: string): T {
  if (Array.isArray(node)) return node.map((n) => applyLanguage(n, lang)) as T;
  if (node && typeof node === "object") {
    const src = node as Blok;
    const out: Blok = {};
    for (const [k, v] of Object.entries(src)) if (!k.includes("__i18n__")) out[k] = applyLanguage(v, lang);
    const suffix = `__i18n__${lang}`;
    for (const [k, v] of Object.entries(src)) if (k.endsWith(suffix) && v !== "" && v != null) out[k.slice(0, -suffix.length)] = applyLanguage(v, lang);
    return out as T;
  }
  return node;
}

function withLive(story: Story, locale: Locale, draft: boolean): Story {
  const hit = draft ? live.get(story.id) : undefined;
  if (!hit || Date.now() - hit.at > LIVE_TTL_MS) return story;
  const content = typeof hit.story.content === "string" ? JSON.parse(hit.story.content) : hit.story.content;
  const lang = LANGUAGE[locale];
  return { ...story, content: lang ? applyLanguage(content, lang) : content };
}

// ---------------------------------------------------------------- fetching
type Params = Record<string, string | number | undefined>;

async function request(path: string, params: Params, draft: boolean, locale: Locale): Promise<{ story?: Story; stories?: Story[]; rels?: Story[] }> {
  const qs = new URLSearchParams(
    Object.entries({
      token: draft ? PREVIEW_TOKEN : PUBLIC_TOKEN,
      version: draft ? "draft" : "published",
      language: LANGUAGE[locale],
      ...(path === "stories" ? { per_page: 100 } : {}),
      ...params,
    })
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)]),
  );
  const res = await fetch(`https://${HOST}/v2/cdn/${path}?${qs}`, draft ? { cache: "no-store" } : { next: { revalidate: 60, tags: ["storyblok"] } });
  if (res.status === 404) return {};
  if (!res.ok) throw new Error(`Storyblok ${res.status} for ${path}`);
  return res.json();
}

const relMap = (rels?: Story[]) => new Map((rels ?? []).map((r) => [r.uuid, r]));

/** One story by full slug, or undefined when it does not exist. `relations` are `component.field` paths to resolve. */
export async function getStory(slug: string, locale: Locale, draft: boolean, relations: string[] = []): Promise<Read<Story | undefined>> {
  const r = await request(`stories/${slug}`, { resolve_relations: relations.join(",") || undefined }, draft, locale);
  return { data: r.story && withLive(r.story, locale, draft), rels: relMap(r.rels) };
}

/** Stories matching the params (e.g. `{ starts_with: "faqs/", content_type: "faq" }`), up to 100. */
export async function getStories(params: Params, locale: Locale, draft: boolean, relations: string[] = []): Promise<Read<Story[]>> {
  const r = await request("stories", { ...params, resolve_relations: relations.join(",") || undefined }, draft, locale);
  return { data: (r.stories ?? []).map((s) => withLive(s, locale, draft)), rels: relMap(r.rels) };
}

// ---------------------------------------------------------------- mapping helpers
/** A relation field: a uuid (look it up in the related stories) or the story itself (the Visual Editor resolves them). */
export function rel(value: unknown, rels: Map<string, Story>): Story | undefined {
  if (typeof value === "string") return rels.get(value);
  return value && typeof value === "object" && "content" in value ? (value as Story) : undefined;
}
export const relList = (value: unknown, rels: Map<string, Story>): Story[] =>
  (Array.isArray(value) ? value : []).map((v) => rel(v, rels)).filter((s): s is Story => !!s);

export const asset = (a?: Blok): { url: string; alt: string } | undefined => (a?.filename ? { url: a.filename, alt: a.alt || a.title || "" } : undefined);
export const text = (v: unknown) => (typeof v === "string" && v ? v : undefined);
/** One item per line (Storyblok has no list-of-strings field). */
export const lines = (s?: string) => (s ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
export const csv = (s?: string) => (s ?? "").split(",").map((v) => v.trim()).filter(Boolean);
/** Storyblok datetime ("2026-01-12 09:00", UTC) to an ISO string. */
export const toIso = (s?: string) => (s ? `${s.replace(" ", "T")}${s.length <= 16 ? ":00" : ""}.000Z` : undefined);
/** Rich text (Storyblok JSON document) to HTML. */
export const html = (doc?: Blok): string => (doc?.content?.length ? (renderRichText(doc as never) as string) : "");

function safeParse(s: string): { id: string | number; uid: string } | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/**
 * Visual Editor attributes for a block. Returned for every field name (`x.$.title`, `x.$.image`...) because Storyblok selects a
 * whole block, not a field. Empty outside preview, so published HTML carries no editing markup.
 */
export function editTags(blok: Blok | undefined, story: Story, draft: boolean): Tags {
  if (!draft || !blok) return {};
  const fromComment = typeof blok._editable === "string" ? safeParse(blok._editable.replace(/^<!--#storyblok#/, "").replace(/-->$/, "")) : null;
  const options = fromComment ?? { name: blok.component, space: SPACE_ID, uid: blok._uid ?? story.uuid, id: String(story.id) };
  const attrs = { "data-blok-c": JSON.stringify(options), "data-blok-uid": `${options.id}-${options.uid}` };
  return new Proxy({}, { get: (_, key) => (typeof key === "string" ? attrs : undefined) });
}
