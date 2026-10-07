import type { Asset, Author, HeroBanner, Link } from "./blog";
import { entriesOf, tagEntry, uniqueByUid, type PreviewParams } from "./contentstack";
import type { Tagged } from "./cslp";
import type { Locale } from "./i18n";
import { rteToHtml } from "./rte";

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
  title: string;
  topic: string;
  sort_order?: number;
  is_featured?: boolean;
  answerHtml: string;
};

export type Guide = Tagged & {
  uid: string;
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
  title: string;
  description?: string;
  hero?: HeroBanner[];
};

export type HomePage = PageEntry & {
  image?: Asset;
  rich_text?: string;
  blocks?: { block: Tagged & { title: string; copy: string; image?: Asset; layout?: "image_left" | "image_right" } }[];
};

// ---------------------------------------------------------------- queries
async function all<T>(contentType: string, locale: Locale, refs: string[] = [], preview?: PreviewParams) {
  let entries = entriesOf(contentType, locale, preview);
  if (refs.length) entries = entries.includeReference(...refs);
  const res = await entries.query().limit(100).find<T>();
  return (uniqueByUid((res.entries ?? []) as { uid?: string }[]) as T[]).map((e) => tagEntry(e, contentType, locale, preview));
}

export async function getNavigation(locale: Locale) {
  return (await all<Navigation>("site_navigation", locale))[0];
}

/** First announcement that is active, in its date window and aimed at this audience. */
export async function getAnnouncement(locale: Locale, audience: "guests" | "logged_in" = "guests") {
  const now = Date.now();
  const bars = await all<Announcement>("announcement_bar", locale);
  return bars.find(
    (b) =>
      b.is_active !== false &&
      (b.audience === "everyone" || b.audience === audience) &&
      (!b.starts_at || Date.parse(b.starts_at) <= now) &&
      (!b.ends_at || Date.parse(b.ends_at) >= now),
  );
}

type RawFaq = Omit<Faq, "answerHtml"> & { answer?: unknown };
const toFaq = (f: RawFaq): Faq => ({ ...f, answerHtml: rteToHtml(f.answer) });

export async function getFaqs(locale: Locale, preview?: PreviewParams) {
  const faqs = (await all<RawFaq>("faq", locale, [], preview)).map(toFaq);
  return faqs.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

export async function getGuides(locale: Locale, preview?: PreviewParams) {
  return all<Guide>("buying_guide", locale, ["author"], preview);
}

export async function getGuide(locale: Locale, slug: string, preview?: PreviewParams) {
  const res = await entriesOf("buying_guide", locale, preview)
    .includeReference("author", "related_faqs")
    .query({ url: `/guides/${slug}` })
    .find<Guide & { related_faqs?: RawFaq[] }>();
  const guide = tagEntry(res.entries?.[0], "buying_guide", locale, preview);
  if (!guide) return undefined;
  return { ...guide, related_faqs: guide.related_faqs?.map(toFaq) } as Guide;
}

export async function getSpotlights(locale: Locale, preview?: PreviewParams) {
  return all<Spotlight>("product_spotlight", locale, [], preview);
}

export async function getPage<T extends PageEntry = PageEntry>(locale: Locale, url: string, preview?: PreviewParams) {
  const res = await entriesOf("page", locale, preview).includeReference("hero").query({ url }).find<T>();
  return tagEntry(res.entries?.[0], "page", locale, preview);
}

export const getHomePage = (locale: Locale, preview?: PreviewParams) => getPage<HomePage>(locale, "/", preview);
