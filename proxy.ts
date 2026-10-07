import { NextResponse, type NextRequest } from "next/server";

// Stories with no page of their own: the Visual Editor opens them at their slug (`/faqs/<slug>`, `/fr/authors/<slug>`), so they are
// rewritten to the page that shows them. Only for editor requests (`_storyblok`). A "real path" in Storyblok would do the same but
// it also drops the language prefix, so French would open the English page.
const EDITOR_PAGE: Record<string, string> = { faqs: "/faq", spotlights: "", authors: "/blog", settings: "" };

/**
 * Locale routing. English (default) has clean URLs and is rewritten internally to /en/...;
 * French lives under /fr. An explicit /en prefix redirects to the clean URL so each page has one address.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const first = pathname.split("/")[1];

  // The Visual Editor opens a story at its slug: the Home story is `home` (`fr/home` in French), which the site serves at `/`.
  if (pathname === "/home" || pathname === "/fr/home") {
    const url = request.nextUrl.clone();
    url.pathname = pathname === "/home" ? "/en" : "/fr";
    return NextResponse.rewrite(url);
  }

  if (request.nextUrl.searchParams.has("_storyblok")) {
    const prefix = first === "fr" ? "/fr" : "";
    const target = EDITOR_PAGE[(prefix ? pathname.slice(3) : pathname).split("/")[1]];
    if (target !== undefined) {
      const url = request.nextUrl.clone();
      url.pathname = `${prefix || "/en"}${target}`;
      return NextResponse.rewrite(url);
    }
  }

  if (first === "fr") return NextResponse.next();

  if (first === "en") {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/en/, "") || "/";
    return NextResponse.redirect(url, 308);
  }

  const url = request.nextUrl.clone();
  url.pathname = `/en${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Skip Next internals and any path with a file extension (images, favicon, etc.)
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
