import { authorFrom, getAuthorMap, heroOf, type Asset, type Author, type HeroBanner, type Link } from "./blog";
import type { Tagged } from "./edit";
import type { Locale } from "./i18n";
import {
  asset, editTags, getStories, getStory, html, lines, link, numbers, strings, toIso,
  type Blok, type PreviewParams, type Story,
} from "./storyblok";

// ---------------------------------------------------------------- types
export type Navigation = Tagged & {
  header_links?: (Tagged & { label: string; href: string; highlight?: boolean })[];
  footer_columns?: { heading: string; links: { label: string; href: string }[] }[];
  contact?: { sales_email?: string; support_phone?: string; opening_hours?: string };
  legal_text?: string;
};

export type Announcement = Tagged & {
  uid: string;
  message: string;
  cta?: Link;
  style: "info" | "promo" | "warning";
  audience: "everyone" | "logged_in" | "guests";
  starts_at?: string;
  ends_at?: string;
  is_active?: boolean;
};

export type Faq = Tagged & {
  uid: string;
  id: number;
  title: string;
  topic: string;
  sort_order?: number;
  is_featured?: boolean;
  answerHtml: string;
};

export type Guide = Tagged & {
  uid: string;
  id: number;
  title: string;
  url: string;
  summary: string;
  hero_image?: Asset;
  audience?: string;
  read_minutes?: number;
  steps?: (Tagged & { step_title: string; step_body: string; pro_tip?: string })[];
  checklist?: string[];
  recommended_bc_products?: number[];
  recommended_skus?: string[];
  related_faqs?: Faq[];
  author?: Author[];
};

export type Spotlight = Tagged & {
  uid: string;
  id: number;
  title: string;
  bc_product_id: number;
  bc_sku?: string;
  tagline: string;
  key_features?: string[];
  use_cases?: { use_case: string; description?: string }[];
  badge?: string;
  editorial_image?: Asset;
  is_featured?: boolean;
};

export type PageEntry = Tagged & {
  uid: string;
  id: number;
  title: string;
  description?: string;
  hero?: HeroBanner[];
};

export type HomePage = PageEntry & {
  image?: Asset;
  rich_text?: string;
  blocks?: { block: Tagged & { title: string; copy: string; image?: Asset; layout?: "image_left" | "image_right" } }[];
};

const ref = (s: Story) => ({ id: s.id, uuid: s.uuid });
const draftOf = (preview?: PreviewParams) => (preview ? ({ draft: true } as const) : undefined);

// ---------------------------------------------------------------- mappers
function faqOf(s: Story, preview?: PreviewParams): Faq {
  const c = s.content;
  return {
    uid: s.uuid, id: s.id, title: c.question, topic: c.topic, sort_order: c.sort_order ? Number(c.sort_order) : undefined,
    is_featured: !!c.is_featured, answerHtml: html(c.answer), $: editTags(c, ref(s), preview),
  };
}

function guideOf(s: Story, authors: Map<string, Author>, preview?: PreviewParams): Guide {
  const c = s.content;
  const faqs = (Array.isArray(c.related_faqs) ? c.related_faqs : []).filter((f: unknown): f is Story => typeof f === "object");
  return {
    uid: s.uuid,
    id: s.id,
    title: c.title,
    url: `/guides/${s.slug}`,
    summary: c.summary,
    hero_image: asset(c.hero_image),
    audience: c.audience || undefined,
    read_minutes: c.read_minutes ? Number(c.read_minutes) : undefined,
    steps: (c.steps ?? []).map((b: Blok) => ({
      step_title: b.step_title, step_body: b.step_body, pro_tip: b.pro_tip || undefined, $: editTags(b, ref(s), preview),
    })),
    checklist: lines(c.checklist),
    recommended_bc_products: numbers(c.recommended_bc_products),
    recommended_skus: strings(c.recommended_skus),
    related_faqs: faqs.map((f: Story) => faqOf(f, preview)),
    author: authorFrom(c.author, authors, preview),
    $: editTags(c, ref(s), preview),
  };
}

function spotlightOf(s: Story, preview?: PreviewParams): Spotlight {
  const c = s.content;
  return {
    uid: s.uuid, id: s.id, title: c.title, bc_product_id: Number(c.bc_product_id), bc_sku: c.bc_sku || undefined, tagline: c.tagline,
    key_features: lines(c.key_features),
    use_cases: (c.use_cases ?? []).map((u: Blok) => ({ use_case: u.use_case, description: u.description || undefined })),
    badge: c.badge || undefined, editorial_image: asset(c.editorial_image), is_featured: !!c.is_featured, $: editTags(c, ref(s), preview),
  };
}

// ---------------------------------------------------------------- queries
export async function getNavigation(locale: Locale): Promise<Navigation | undefined> {
  const s = await getStory("settings/navigation", locale);
  if (!s) return undefined;
  const c = s.content;
  return {
    header_links: (c.header_links ?? []).map((l: Blok) => ({ label: l.label, href: l.href, highlight: !!l.highlight })),
    footer_columns: (c.footer_columns ?? []).map((col: Blok) => ({
      heading: col.heading,
      links: (col.links ?? []).map((l: Blok) => ({ label: l.label, href: l.href })),
    })),
    contact: { sales_email: c.sales_email, support_phone: c.support_phone, opening_hours: c.opening_hours },
    legal_text: c.legal_text,
  };
}

/** First announcement that is active, in its date window and aimed at this audience. */
export async function getAnnouncement(locale: Locale, audience: "guests" | "logged_in" = "guests") {
  const now = Date.now();
  const stories = await getStories({ starts_with: "settings/", content_type: "announcement_bar" }, locale);
  const bars: Announcement[] = stories.map((s) => ({
    uid: s.uuid, message: s.content.message, cta: link(s.content.cta_label, s.content.cta_href), style: s.content.style,
    audience: s.content.audience, starts_at: toIso(s.content.starts_at), ends_at: toIso(s.content.ends_at), is_active: s.content.is_active !== false,
  }));
  return bars.find(
    (b) =>
      b.is_active !== false &&
      (b.audience === "everyone" || b.audience === audience) &&
      (!b.starts_at || Date.parse(b.starts_at) <= now) &&
      (!b.ends_at || Date.parse(b.ends_at) >= now),
  );
}

export async function getFaqs(locale: Locale, preview?: PreviewParams) {
  const stories = await getStories({ starts_with: "faqs/", content_type: "faq" }, locale, preview);
  return stories.map((s) => faqOf(s, preview)).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

export async function getGuides(locale: Locale, preview?: PreviewParams) {
  const [stories, authors] = await Promise.all([
    getStories({ starts_with: "guides/", content_type: "buying_guide" }, locale, preview),
    getAuthorMap(locale, !!draftOf(preview)),
  ]);
  return stories.map((s) => guideOf(s, authors, preview));
}

export async function getGuide(locale: Locale, slug: string, preview?: PreviewParams) {
  const [s, authors] = await Promise.all([
    getStory(`guides/${slug}`, locale, preview, ["buying_guide.related_faqs"]),
    getAuthorMap(locale, !!draftOf(preview)),
  ]);
  return s ? guideOf(s, authors, preview) : undefined;
}

export async function getSpotlights(locale: Locale, preview?: PreviewParams) {
  const stories = await getStories({ starts_with: "spotlights/", content_type: "product_spotlight" }, locale, preview);
  return stories.map((s) => spotlightOf(s, preview));
}

/** A `page` story by storefront URL: `/` is the Home story, `/faq` the FAQ story, `/guides` the guides folder's start page. */
export async function getPage<T extends PageEntry = PageEntry>(locale: Locale, url: string, preview?: PreviewParams) {
  const s = await getStory(url === "/" ? "home" : url.slice(1), locale, preview);
  if (!s) return undefined;
  const c = s.content;
  const page: HomePage = {
    uid: s.uuid,
    id: s.id,
    title: c.title,
    description: c.description || undefined,
    hero: c.hero?.[0] ? [heroOf(c.hero[0], s, preview)!] : undefined,
    image: asset(c.image),
    rich_text: html(c.intro) || undefined,
    blocks: (c.blocks ?? []).map((b: Blok) => ({
      block: { title: b.title, copy: html(b.copy), image: asset(b.image), layout: b.layout || "image_left", $: editTags(b, ref(s), preview) },
    })),
    $: editTags(c, ref(s), preview),
  };
  return page as unknown as T;
}

export const getHomePage = (locale: Locale, preview?: PreviewParams) => getPage<HomePage>(locale, "/", preview);
