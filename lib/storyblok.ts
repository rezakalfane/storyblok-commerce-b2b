import { createHash } from "node:crypto";
import { renderRichText } from "@storyblok/richtext";
import { cache } from "react";
import StoryblokClient from "storyblok-js-client";
import type { Tags } from "./edit";
import { SB_LANGUAGE, type Locale } from "./i18n";

const REGION = (process.env.STORYBLOK_REGION ?? "eu").toLowerCase();
export const SPACE_ID = process.env.STORYBLOK_SPACE_ID ?? "";
const PREVIEW_TOKEN = process.env.STORYBLOK_PREVIEW_TOKEN ?? "";
/** Published content is read with the Public token when there is one (it cannot read drafts at all). */
const PUBLIC_TOKEN = process.env.STORYBLOK_PUBLIC_TOKEN || PREVIEW_TOKEN;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Blok = Record<string, any>;
export type Story = { id: number; uuid: string; name: string; slug: string; full_slug: string; content: Blok };

const newClient = (accessToken: string) =>
  new StoryblokClient({ accessToken, region: REGION as "eu", cache: { clear: "auto", type: "none" } });
const published = newClient(PUBLIC_TOKEN);
const draft = newClient(PREVIEW_TOKEN);

// ---------------------------------------------------------------- preview (Visual Editor)
/** Set when the page is opened inside the Visual Editor: draft content is read with the preview token. */
export type PreviewParams = { draft: true };

/**
 * The Visual Editor opens the site with `_storyblok` and a signed `_storyblok_tk[...]` set of params. Drafts are only served
 * when the signature (sha1 of `space:previewToken:timestamp`, issued less than an hour ago) is valid, so a bare
 * `?_storyblok=1` cannot be used to read unpublished content. In local development the signature is not required.
 */
export function previewParams(sp: Record<string, string | string[] | undefined>): PreviewParams | undefined {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  if (!one(sp._storyblok)) return undefined;
  if (process.env.NODE_ENV !== "production") return { draft: true };
  const space = one(sp["_storyblok_tk[space_id]"]);
  const timestamp = one(sp["_storyblok_tk[timestamp]"]);
  const token = one(sp["_storyblok_tk[token]"]);
  if (!space || !timestamp || !token || space !== SPACE_ID) return undefined;
  const fresh = Math.abs(Date.now() / 1000 - Number(timestamp)) < 3600;
  const valid = createHash("sha1").update(`${space}:${PREVIEW_TOKEN}:${timestamp}`).digest("hex") === token;
  return fresh && valid ? { draft: true } : undefined;
}

// ---------------------------------------------------------------- fetching
type Params = Record<string, string | number | undefined>;

const isNotFound = (e: unknown) => {
  const err = e as { status?: number; message?: string };
  return err?.status === 404 || /404/.test(err?.message ?? "");
};

const fetchOptions = (isDraft: boolean) => (isDraft ? { cache: "no-store" as const } : { next: { revalidate: 60, tags: ["storyblok"] } });

/** The live-edit cache filled by the Visual Editor integration (`StoryblokLiveEditing`): the unsaved story, by story id. */
const liveCache = () => (globalThis as { storyCache?: Map<string, Story> }).storyCache;

/** Copies `field__i18n__<lang>` values over `field` (Storyblok stores translations next to the default value). */
function applyLanguage<T>(node: T, lang: string): T {
  if (Array.isArray(node)) return node.map((n) => applyLanguage(n, lang)) as T;
  if (node && typeof node === "object") {
    const src = node as Blok;
    const out: Blok = {};
    for (const [k, v] of Object.entries(src)) if (!k.includes("__i18n__")) out[k] = applyLanguage(v, lang);
    const suffix = `__i18n__${lang}`;
    for (const [k, v] of Object.entries(src)) {
      if (k.endsWith(suffix) && v !== "" && v != null) out[k.slice(0, -suffix.length)] = applyLanguage(v, lang);
    }
    return out as T;
  }
  return node;
}

/** In the Visual Editor, a story being edited arrives (unsaved) through the live-edit cache and replaces the saved one. */
function withLiveEdit(story: Story, isDraft: boolean, lang: string): Story {
  const hit = isDraft ? liveCache()?.get(String(story.id)) : undefined;
  if (!hit) return story;
  liveCache()?.delete(String(story.id));
  const content = typeof hit.content === "string" ? JSON.parse(hit.content) : hit.content;
  return { ...story, ...hit, content: lang === "default" ? content : applyLanguage(content, lang) };
}

// `cache()` shares one fetch between generateMetadata, the page and the layout within a single request, which also makes
// the one-shot live-edit cache safe to consume.
const fetchStory = cache(async (slug: string, language: string, isDraft: boolean, relations: string) => {
  try {
    const { data } = await (isDraft ? draft : published).get(
      `cdn/stories/${slug}`,
      { version: isDraft ? "draft" : "published", language, resolve_relations: relations || undefined },
      fetchOptions(isDraft),
    );
    return withLiveEdit(data.story as Story, isDraft, language);
  } catch (e) {
    if (isNotFound(e)) return undefined;
    throw e;
  }
});

const fetchStories = cache(async (params: string, language: string, isDraft: boolean) => {
  const { data } = await (isDraft ? draft : published).get(
    "cdn/stories",
    { version: isDraft ? "draft" : "published", language, per_page: 100, ...(JSON.parse(params) as Params) },
    fetchOptions(isDraft),
  );
  return (data.stories as Story[]).map((s) => withLiveEdit(s, isDraft, language));
});

/** One story by full slug (a folder's start page is addressed by the folder slug). Undefined when it does not exist. */
export function getStory(slug: string, locale: Locale, preview?: PreviewParams, relations: string[] = []) {
  return fetchStory(slug, SB_LANGUAGE[locale], !!preview, relations.join(","));
}

/** Stories matching the params (e.g. `{ starts_with: "faqs/", content_type: "faq" }`), up to 100. */
export function getStories(params: Params, locale: Locale, preview?: PreviewParams) {
  return fetchStories(JSON.stringify(params), SB_LANGUAGE[locale], !!preview);
}

// ---------------------------------------------------------------- mapping helpers
export type Asset = { uid: string; url: string; title?: string };
export type Link = { title?: string; href?: string };

export const asset = (a?: Blok): Asset | undefined =>
  a?.filename ? { uid: String(a.id ?? a.filename), url: a.filename, title: a.alt || a.title || undefined } : undefined;

export const link = (title?: string, href?: string): Link | undefined => (href ? { title, href } : undefined);

/** One item per line (Storyblok has no list-of-strings field). */
export const lines = (s?: string) => (s ?? "").split("\n").map((l) => l.trim()).filter(Boolean);

/** Comma-separated numbers / strings. */
export const numbers = (s?: string) => (s ?? "").split(",").map((n) => Number(n.trim())).filter((n) => Number.isFinite(n) && n > 0);
export const strings = (s?: string) => (s ?? "").split(",").map((v) => v.trim()).filter(Boolean);

/** Storyblok datetime ("2026-01-12 09:00", UTC) to an ISO string. */
export const toIso = (s?: string) => (s ? `${s.replace(" ", "T")}${s.length <= 16 ? ":00" : ""}.000Z` : undefined);

/** Rich text (Storyblok JSON document) to HTML. */
export const html = (doc?: Blok): string => (doc?.content?.length ? (renderRichText(doc as never) as string) : "");

/**
 * Visual Editor attributes for a block. Returned for every field name (`x.$.title`, `x.$.steps__parent`...) because Storyblok
 * selects a whole block, not a field. Empty outside the editor, so published HTML carries no editing markup.
 */
export function editTags(blok: Blok | undefined, ref: { id: number; uuid: string }, preview?: PreviewParams): Tags {
  if (!preview || !blok) return {};
  const fromComment = typeof blok._editable === "string" ? safeParse(blok._editable.replace(/^<!--#storyblok#/, "").replace(/-->$/, "")) : null;
  const options = fromComment ?? { name: blok.component, space: SPACE_ID, uid: blok._uid ?? ref.uuid, id: String(ref.id) };
  const attrs = { "data-blok-c": JSON.stringify(options), "data-blok-uid": `${options.id}-${options.uid}` };
  return new Proxy({}, { get: (_, key) => (typeof key === "string" ? attrs : undefined) });
}

function safeParse(s: string): { id: string | number; uid: string } | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
