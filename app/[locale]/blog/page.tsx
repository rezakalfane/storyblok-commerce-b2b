import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EditSupport } from "@/components/edit-support";
import { Hero } from "@/components/hero";
import { PostGrid } from "@/components/post-card";
import { getListingPage, getPosts } from "@/lib/blog";
import { previewParams } from "@/lib/contentstack";
import { alternatesFor, getMessages, isLocale, localePath } from "@/lib/i18n";

export async function generateMetadata({ params }: PageProps<"/[locale]/blog">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const listing = await getListingPage(locale);
  return { title: listing?.title ?? "Blog", alternates: alternatesFor(locale, "/blog") };
}

export default async function BlogPage({ params, searchParams }: PageProps<"/[locale]/blog">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getMessages(locale);
  const sp = await searchParams;
  const preview = previewParams(sp);
  const q = (typeof sp.q === "string" ? sp.q : "").trim().toLowerCase();

  const [listing, allPosts] = await Promise.all([getListingPage(locale, preview), getPosts(locale, preview)]);
  const posts = q
    ? allPosts.filter((p) => `${p.title} ${p.seo?.meta_description ?? ""}`.toLowerCase().includes(q))
    : allPosts;
  const hero = listing?.page_components?.find((c) => c.hero_banner?.hero_banner?.[0])?.hero_banner?.hero_banner?.[0];

  return (
    <>
      <EditSupport preview={preview} entry={listing && { uid: listing.uid, contentType: "blog_listing_page" }} />
      {hero && <Hero hero={hero} locale={locale} />}

      <div className="page section space-y-14">
        <form action={localePath(locale, "/blog")} className="flex max-w-xl gap-3">
          <input
            name="q"
            defaultValue={q}
            aria-label={t.search}
            placeholder={listing?.search?.placeholder_text ?? t.searchPlaceholder}
            className="field flex-1"
          />
          <button className="btn btn-primary">{listing?.search?.search_button?.title ?? t.search}</button>
        </form>

        {q ? (
          <section>
            <h2 className="mb-8">
              {posts.length} {posts.length === 1 ? t.result : t.results} {t.resultsFor} “{q}”
            </h2>
            <PostGrid posts={posts} locale={locale} />
          </section>
        ) : (
          <>
            {listing?.page_components?.map((c, i) =>
              c.from_blog?.featured_blogs?.length ? (
                <section key={i}>
                  <h2 {...(c.from_blog.$?.title_h2 ?? {})} className="mb-8">
                    {c.from_blog.title_h2}
                  </h2>
                  <PostGrid posts={c.from_blog.featured_blogs} locale={locale} />
                </section>
              ) : null,
            )}

            <section>
              <h2 className="mb-8">{t.allArticles}</h2>
              <PostGrid posts={posts} locale={locale} />
            </section>
          </>
        )}
      </div>
    </>
  );
}
