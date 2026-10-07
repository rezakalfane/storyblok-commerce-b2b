"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LANGUAGE_NAME, LOCALES, localePath, stripLocale, type Locale } from "@/lib/i18n";

/** Links to the same page in every locale. Slugs are shared across locales, so only the prefix changes. */
export function LocaleSwitcher({ locale, label }: { locale: Locale; label: string }) {
  const pathname = usePathname();
  const q = useSearchParams().toString();
  const base = stripLocale(pathname);
  return (
    <ul className="flex items-center text-[0.95rem]" aria-label={label}>
      {LOCALES.map((l, i) => (
        <li key={l} className={i > 0 ? "ml-2 border-l border-line pl-2" : ""}>
          <Link
            href={localePath(l, base) + (q ? `?${q}` : "")}
            hrefLang={l}
            lang={l}
            aria-current={l === locale ? "true" : undefined}
            className={
              l === locale
                ? "font-semibold underline decoration-amber decoration-2 underline-offset-4"
                : "text-slate hover:text-ink"
            }
          >
            {l.toUpperCase()}
            <span className="sr-only"> {LANGUAGE_NAME[l]}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
