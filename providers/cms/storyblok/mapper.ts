import { cache } from "react";
import type { Announcement, Author, Block, Faq, Guide, Hero, Img, Navigation, Page, Post, PostBlock, Spotlight } from "@/core/content";
import type { Tags } from "@/core/edit";
import type { Locale } from "@/lib/i18n";
import { asset, csv, editTags, getStories, getStory, html, lines, rel, relList, text, toIso, type Blok, type Story } from "./client";

// Stories -> the canonical content model (core/content.ts). `$` carries Visual Editor attributes for draft requests only.
type Ctx = { story: Story; rels: Map<string, Story>; authors: Map<string, Author>; draft: boolean };
const tags = (blok: Blok, c: Ctx): { $?: Tags } => (c.draft ? { $: editTags(blok, c.story, true) } : {});
const img = (a: Blok | undefined, alt?: string): Img | undefined => {
  const x = asset(a);
  return x ? { url: x.url, alt: alt || x.alt } : undefined;
};

/** The relation fields resolved when a story is read (`component.field`). */
const RELATIONS = ["collection_block.items", "blog_post.author", "buying_guide.author", "buying_guide.related_faqs"];

const authorOf = (s: Story, draft: boolean): Author => ({
  name: s.content.name,
  avatar: img(s.content.picture, s.content.name),
  bio: text(s.content.bio),
  ...(draft ? { $: editTags(s.content, s, true) } : {}),
});

/** Every author by story uuid: one request beats resolving them per post. */
const getAuthorMap = cache(async (locale: Locale, draft: boolean) => {
  const { data } = await getStories({ starts_with: "authors/", content_type: "author" }, locale, draft);
  return new Map(data.map((s) => [s.uuid, authorOf(s, draft)]));
});

function authorFrom(value: unknown, c: Ctx): Author | undefined {
  const s = rel(value, c.rels);
  return s ? (c.authors.get(s.uuid) ?? authorOf(s, c.draft)) : typeof value === "string" ? c.authors.get(value) : undefined;
}

function faq(s: Story, draft: boolean): Faq {
  const f = s.content;
  return {
    id: s.uuid,
    question: f.question,
    answerHtml: html(f.answer),
    topic: f.topic,
    sortOrder: f.sort_order ? Number(f.sort_order) : 0,
    featured: !!f.is_featured,
    ...(draft ? { $: editTags(f, s, true) } : {}),
  };
}

function guide(s: Story, order: number, authors: Map<string, Author>, rels: Map<string, Story>, draft: boolean): Guide {
  const f = s.content;
  const c: Ctx = { story: s, rels, authors, draft };
  const skus = csv(f.recommended_skus);
  return {
    id: s.uuid,
    url: `/guides/${s.slug}`,
    title: f.title,
    summary: f.summary,
    image: img(f.hero_image, f.title),
    audience: text(f.audience),
    readMinutes: f.read_minutes ? Number(f.read_minutes) : undefined,
    sortOrder: order,
    steps: (f.steps ?? []).map((b: Blok) => ({ title: b.step_title, body: b.step_body, proTip: text(b.pro_tip), ...tags(b, c) })),
    checklist: lines(f.checklist),
    recommendedProducts: csv(f.recommended_bc_products).map(Number).filter((n) => n > 0).map((id, i) => ({ bcProductId: id, sku: skus[i] })),
    relatedFaqs: relList(f.related_faqs, rels).map((x) => faq(x, draft)),
    author: authorFrom(f.author, c),
    ...tags(f, c),
  };
}

const spotlight = (s: Story, draft: boolean): Spotlight => {
  const f = s.content;
  const c = { story: s, draft } as Ctx;
  return {
    id: s.uuid,
    title: f.title,
    bcProductId: Number(f.bc_product_id),
    bcSku: text(f.bc_sku),
    tagline: f.tagline,
    badge: text(f.badge),
    image: img(f.editorial_image, f.title),
    featured: !!f.is_featured,
    keyFeatures: lines(f.key_features),
    useCases: (f.use_cases ?? []).map((u: Blok) => ({ title: u.use_case, description: text(u.description), ...tags(u, c) })),
    ...(draft ? { $: editTags(f, s, true) } : {}),
  };
};

function postBlocks(bloks: Blok[] | undefined, c: Ctx): PostBlock[] {
  return (bloks ?? []).flatMap((b): PostBlock[] => {
    const t = tags(b, c);
    if (b.component === "text_block") return [{ type: "text", html: html(b.text), ...t }];
    if (b.component === "image_block") {
      const i = img(b.image, text(b.alt));
      return i ? [{ type: "image", img: i, ...t }] : [];
    }
    if (b.component === "video_block") return [{ type: "video", title: b.video_title ?? "", src: b.src, ...t }];
    return [];
  });
}

function post(s: Story, authors: Map<string, Author>, rels: Map<string, Story>, draft: boolean): Post {
  const f = s.content;
  const c: Ctx = { story: s, rels, authors, draft };
  const writer = authorFrom(f.author, c);
  return {
    id: s.uuid,
    url: `/blog/${s.slug}`,
    title: f.title,
    description: text(f.seo_description),
    date: toIso(f.date),
    readTime: f.read_time ? Number(f.read_time) : undefined,
    image: img(f.featured_image, f.title),
    authors: writer ? [writer] : [],
    blocks: postBlocks(f.content, c),
    ...tags(f, c),
  };
}

const hero = (b: Blok, c: Ctx): Hero => ({
  title: b.title,
  description: text(b.description),
  image: img(b.image, b.title),
  secondImage: img(b.second_image, b.title),
  cta: b.cta_label || b.cta_href ? { label: text(b.cta_label), href: text(b.cta_href) } : undefined,
  variant: b.variant === "home" ? "home" : "default",
  ...tags(b, c),
});

/** The stories of a collection, of one content type (an editor may link anything; only the expected type shows). */
const items = (b: Blok, c: Ctx, type: string) => relList(b.items, c.rels).filter((s) => s.content.component === type);

function block(b: Blok, c: Ctx): Block[] {
  const t = tags(b, c);
  switch (b.component) {
    case "hero_banner":
      return [{ type: "hero", hero: hero(b, c), ...t }];
    case "feature_block":
      return [{ type: "feature", title: b.title, html: html(b.copy), image: img(b.image, b.title), layout: b.layout === "image_right" ? "image_right" : "image_left", ...t }];
    case "text_block":
      return [{ type: "text", html: html(b.text), ...t }];
    case "image_block": {
      const i = img(b.image, text(b.alt));
      return i ? [{ type: "image", img: i, ...t }] : [];
    }
    case "video_block":
      return [{ type: "video", title: b.video_title ?? "", src: b.src, ...t }];
    case "collection_block":
      switch (b.kind) {
        case "categories":
          return [{ type: "categories", title: text(b.title), ...t }];
        case "spotlights":
          return [{ type: "spotlights", title: text(b.title), items: items(b, c, "product_spotlight").map((s) => spotlight(s, c.draft)), ...t }];
        case "guides":
          return [{ type: "guides", title: text(b.title), linkLabel: text(b.link_label), items: items(b, c, "buying_guide").map((s, i) => guide(s, i, c.authors, c.rels, c.draft)), ...t }];
        case "posts":
          return [{ type: "posts", title: text(b.title), items: items(b, c, "blog_post").map((s) => post(s, c.authors, c.rels, c.draft)), ...t }];
        case "postListing":
          return [{ type: "postListing", title: text(b.title), searchPlaceholder: text(b.search_placeholder), searchButtonLabel: text(b.search_button_label), ...t }];
        case "guideListing":
          return [{ type: "guideListing", title: text(b.title), ...t }];
        case "faqs":
          return [{ type: "faqs", items: items(b, c, "faq").map((s) => faq(s, c.draft)).sort((x, y) => x.sortOrder - y.sortOrder), ...t }];
        default:
          return [];
      }
    default:
      return [];
  }
}

// ---------------------------------------------------------------- queries
export async function getPage(key: string, locale: Locale, draft: boolean): Promise<Page | undefined> {
  const [{ data: s, rels }, authors] = await Promise.all([getStory(`pages/${key}`, locale, draft, RELATIONS), getAuthorMap(locale, draft)]);
  if (!s) return undefined;
  const c: Ctx = { story: s, rels, authors, draft };
  return { title: s.content.title, description: text(s.content.description), blocks: (s.content.components ?? []).flatMap((b: Blok) => block(b, c)), ...tags(s.content, c) };
}

async function announcements(locale: Locale, draft: boolean): Promise<Announcement[]> {
  const now = Date.now();
  const { data } = await getStories({ starts_with: "settings/", content_type: "announcement_bar", sort_by: "created_at:asc" }, locale, draft);
  return data
    .filter((s) => s.content.is_active !== false)
    .filter((s) => (!s.content.starts_at || Date.parse(toIso(s.content.starts_at)!) <= now) && (!s.content.ends_at || Date.parse(toIso(s.content.ends_at)!) >= now))
    .map((s) => ({
      message: s.content.message,
      cta: s.content.cta_label || s.content.cta_href ? { label: text(s.content.cta_label), href: text(s.content.cta_href) } : undefined,
      style: s.content.style,
      audience: s.content.audience,
      ...(draft ? { $: editTags(s.content, s, true) } : {}),
    }));
}

export async function getNavigation(locale: Locale, draft: boolean): Promise<Navigation | undefined> {
  const { data: s } = await getStory("settings/navigation", locale, draft);
  if (!s) return undefined;
  const f = s.content;
  return {
    headerLinks: (f.header_links ?? []).map((l: Blok) => ({ label: l.label, href: l.href, highlight: !!l.highlight })),
    footerColumns: (f.footer_columns ?? []).map((col: Blok) => ({
      heading: col.heading,
      links: (col.links ?? []).map((l: Blok) => ({ label: l.label, href: l.href })),
    })),
    contact: { salesEmail: text(f.sales_email), supportPhone: text(f.support_phone), openingHours: text(f.opening_hours) },
    legalText: text(f.legal_text),
    announcements: await announcements(locale, draft),
  };
}

export async function getAnnouncement(locale: Locale, draft: boolean, audience: "guests" | "logged_in" = "guests") {
  return (await announcements(locale, draft)).find((a) => a.audience === "everyone" || a.audience === audience);
}

export async function getPosts(locale: Locale, draft: boolean) {
  const [{ data, rels }, authors] = await Promise.all([
    getStories({ starts_with: "blog/", content_type: "blog_post", sort_by: "content.date:desc" }, locale, draft),
    getAuthorMap(locale, draft),
  ]);
  return data.map((s) => post(s, authors, rels, draft));
}

export async function getPost(slug: string, locale: Locale, draft: boolean) {
  const [{ data: s, rels }, authors] = await Promise.all([getStory(`blog/${slug}`, locale, draft, RELATIONS), getAuthorMap(locale, draft)]);
  return s && s.content.component === "blog_post" ? post(s, authors, rels, draft) : undefined;
}

export async function getGuides(locale: Locale, draft: boolean) {
  const [{ data, rels }, authors] = await Promise.all([
    getStories({ starts_with: "guides/", content_type: "buying_guide", sort_by: "created_at:asc" }, locale, draft, ["buying_guide.related_faqs", "buying_guide.author"]),
    getAuthorMap(locale, draft),
  ]);
  return data.map((s, i) => guide(s, i, authors, rels, draft));
}

export async function getGuide(slug: string, locale: Locale, draft: boolean) {
  const [{ data: s, rels }, authors] = await Promise.all([getStory(`guides/${slug}`, locale, draft, RELATIONS), getAuthorMap(locale, draft)]);
  return s && s.content.component === "buying_guide" ? guide(s, 0, authors, rels, draft) : undefined;
}

export async function getSpotlights(locale: Locale, draft: boolean) {
  const { data } = await getStories({ starts_with: "spotlights/", content_type: "product_spotlight", sort_by: "created_at:asc" }, locale, draft);
  return data.map((s) => spotlight(s, draft));
}
