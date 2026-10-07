import { NextResponse, type NextRequest } from "next/server";

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
