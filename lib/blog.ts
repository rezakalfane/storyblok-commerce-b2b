import { jsonToHTML } from "@contentstack/utils";
import { entriesOf, tagEntry, uniqueByUid, type PreviewParams } from "./contentstack";
import type { Tagged } from "./cslp";
import type { Locale } from "./i18n";

export type Asset = { uid: string; url: string; title?: string; filename?: string };
export type Link = { title?: string; href?: string };

export type Author = Tagged & { uid: string; title: string; picture?: Asset; bio?: string };

export type Post = Tagged & {
  uid: string;
  title: string;
  url: string;
  date?: string;
  author?: Author[];
  featured_image?: Asset;
  body?: unknown;
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

/** One entry of the listing page's `page_components` modular blocks field. */
export type PageComponent = {
  hero_banner?: Tagged & { hero_banner?: HeroBanner[] };
  from_blog?: Tagged & { title_h2?: string; featured_blogs?: Post[]; view_articles?: Link };
  widget?: Tagged & { title_h2?: string; type?: string; related_blogs?: Post[] };
};

export type ListingPage = Tagged & {
  uid: string;
  title: string;
  search?: { placeholder_text?: string; search_button?: Link };
  page_components?: PageComponent[];
};

const POST_REFS = ["author", "related_post", "related_post.author"];

export async function getListingPage(locale: Locale, preview?: PreviewParams) {
  const res = await entriesOf("blog_listing_page", locale, preview)
    .includeReference(
      "page_components.hero_banner.hero_banner",
      "page_components.from_blog.featured_blogs",
      "page_components.from_blog.featured_blogs.author",
      "page_components.widget.related_blogs",
      "page_components.widget.related_blogs.author",
    )
    .query({ url: "/blog" })
    .find<ListingPage>();
  return tagEntry(res.entries?.[0], "blog_listing_page", locale, preview);
}

export async function getPosts(locale: Locale, preview?: PreviewParams) {
  const res = await entriesOf("blog_landing_page", locale, preview)
    .includeReference("author")
    .query()
    .orderByDescending("date")
    .limit(100)
    .find<Post>();
  return (uniqueByUid(res.entries ?? []) as Post[]).map((p) => tagEntry(p, "blog_landing_page", locale, preview));
}

export async function getPost(locale: Locale, slug: string, preview?: PreviewParams) {
  const res = await entriesOf("blog_landing_page", locale, preview)
    .includeReference(...POST_REFS)
    .query({ url: `/blog/${slug}` })
    .find<Post>();
  const post = tagEntry(res.entries?.[0], "blog_landing_page", locale, preview);
  if (!post) return undefined;
  // Convert the JSON RTE body to HTML for rendering.
  const holder = { body: post.body } as unknown as Parameters<typeof jsonToHTML>[0]["entry"];
  jsonToHTML({ entry: holder, paths: ["body"] });
  post.bodyHtml = (holder as unknown as { body: string }).body;
  return post;
}

export const firstAuthor = (p: Post) => p.author?.[0];
