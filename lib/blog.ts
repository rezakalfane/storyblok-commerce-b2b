import { cache } from "react";
import type { Tagged } from "./edit";
import type { Locale } from "./i18n";
import {
  asset, editTags, getStories, getStory, html, link, toIso,
  type Asset, type Blok, type Link, type PreviewParams, type Story,
} from "./storyblok";

export type { Asset, Link };

export type Author = Tagged & { uid: string; id: number; title: string; picture?: Asset; bio?: string };

export type Post = Tagged & {
  uid: string;
  id: number;
  title: string;
  url: string;
  date?: string;
  author?: Author[];
  featured_image?: Asset;
  bodyHtml?: string;
  related_post?: Post[];
  seo?: { meta_title?: string; meta_description?: string };
};

export type HeroBanner = Tagged & {
  title: string;
  banner_image?: Asset;
  banner_description?: string;
  call_to_action?: Link;
};

export type ListingPage = Tagged & {
  uid: string;
  id: number;
  title: string;
  hero?: HeroBanner;
  search_placeholder?: string;
  search_button_label?: string;
  featured_title?: string;
  featured_posts: Post[];
  view_all_label?: string;
  related_title?: string;
  related_posts: Post[];
};

const ref = (s: Story) => ({ id: s.id, uuid: s.uuid });

// ---------------------------------------------------------------- mappers
export function authorOf(s: Story, preview?: PreviewParams): Author {
  const c = s.content;
  return { uid: s.uuid, id: s.id, title: c.name, picture: asset(c.picture), bio: c.bio || undefined, $: editTags(c, ref(s), preview) };
}

/** Every author of the locale by story uuid. Reference fields hold uuids, and one request beats resolving them per post. */
export const getAuthorMap = cache(async (locale: Locale, draft: boolean) => {
  const stories = await getStories({ starts_with: "authors/", content_type: "author" }, locale, draft ? { draft: true } : undefined);
  return new Map(stories.map((s) => [s.uuid, authorOf(s, draft ? { draft: true } : undefined)]));
});

/** A single reference field: a uuid string, or the story itself when the Visual Editor resolved it. */
export function authorFrom(value: unknown, authors: Map<string, Author>, preview?: PreviewParams): Author[] | undefined {
  const a = typeof value === "string" ? authors.get(value) : value && typeof value === "object" ? authorOf(value as Story, preview) : undefined;
  return a ? [a] : undefined;
}

export function heroOf(blok: Blok | undefined, s: Story, preview?: PreviewParams): HeroBanner | undefined {
  if (!blok) return undefined;
  return {
    title: blok.title,
    banner_image: asset(blok.image),
    banner_description: blok.description || undefined,
    call_to_action: link(blok.cta_label, blok.cta_href),
    $: editTags(blok, ref(s), preview),
  };
}

export function postOf(s: Story, authors: Map<string, Author>, preview?: PreviewParams, withRelated = false): Post {
  const c = s.content;
  const related = c.related_post && typeof c.related_post === "object" ? [postOf(c.related_post as Story, authors, preview)] : undefined;
  return {
    uid: s.uuid,
    id: s.id,
    title: c.title,
    url: `/blog/${s.slug}`,
    date: toIso(c.date),
    author: authorFrom(c.author, authors, preview),
    featured_image: asset(c.featured_image),
    bodyHtml: html(c.body),
    related_post: withRelated ? related : undefined,
    seo: { meta_title: c.seo_title || undefined, meta_description: c.seo_description || undefined },
    $: editTags(c, ref(s), preview),
  };
}

// ---------------------------------------------------------------- queries
const LISTING_REFS = ["blog_listing_page.featured_posts", "blog_listing_page.related_posts"];

export async function getListingPage(locale: Locale, preview?: PreviewParams): Promise<ListingPage | undefined> {
  const [s, authors] = await Promise.all([getStory("blog", locale, preview, LISTING_REFS), getAuthorMap(locale, !!preview)]);
  if (!s) return undefined;
  const c = s.content;
  // Unresolved references are uuid strings: only resolved stories carry content.
  const posts = (v: unknown) => (Array.isArray(v) ? v : []).filter((p): p is Story => typeof p === "object").map((p) => postOf(p, authors, preview));
  return {
    uid: s.uuid,
    id: s.id,
    title: c.title,
    hero: heroOf(c.hero?.[0], s, preview),
    search_placeholder: c.search_placeholder || undefined,
    search_button_label: c.search_button_label || undefined,
    featured_title: c.featured_title || undefined,
    featured_posts: posts(c.featured_posts),
    view_all_label: c.view_all_label || undefined,
    related_title: c.related_title || undefined,
    related_posts: posts(c.related_posts),
    $: editTags(c, ref(s), preview),
  };
}

export async function getPosts(locale: Locale, preview?: PreviewParams) {
  const [stories, authors] = await Promise.all([
    getStories({ starts_with: "blog/", content_type: "blog_post", sort_by: "content.date:desc" }, locale, preview),
    getAuthorMap(locale, !!preview),
  ]);
  return stories.map((s) => postOf(s, authors, preview));
}

export async function getPost(locale: Locale, slug: string, preview?: PreviewParams) {
  const [s, authors] = await Promise.all([getStory(`blog/${slug}`, locale, preview, ["blog_post.related_post"]), getAuthorMap(locale, !!preview)]);
  return s ? postOf(s, authors, preview, true) : undefined;
}

export const firstAuthor = (p: Post) => p.author?.[0];
