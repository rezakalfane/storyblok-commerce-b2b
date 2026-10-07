import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plp } from "@/components/plp";
import { parseCatalogParams, searchCatalog } from "@/lib/bigcommerce";
import { alternatesFor, CATEGORY_TILES, categoryLabel, getMessages, isLocale, localePath } from "@/lib/i18n";

export async function generateMetadata({ params }: PageProps<"/[locale]/products">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getMessages(locale).allProducts, alternates: alternatesFor(locale, "/products") };
}

export default async function ProductsPage({ params, searchParams }: PageProps<"/[locale]/products">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getMessages(locale);
  const query = parseCatalogParams(await searchParams);
  const result = await searchCatalog(locale, query);

  return (
    <div className="page py-10 md:py-14">
      <h1>{t.allProducts}</h1>
      <p className="mt-4 max-w-[52ch] text-lg text-slate">{t.productsIntro}</p>

      <nav aria-label={t.shopByCategory} className="mt-8 flex flex-wrap gap-2">
        {CATEGORY_TILES.map((c) => (
          <Link
            key={c.path}
            href={localePath(locale, c.path)}
            className="rounded-full border-[1.5px] border-line px-4 py-1.5 text-[0.95rem] font-medium hover:border-ink"
          >
            {categoryLabel(locale, c.name)}
          </Link>
        ))}
      </nav>

      <Plp locale={locale} basePath="/products" result={result} params={query} />
    </div>
  );
}
