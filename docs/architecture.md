# Architecture

## Overview

![Architecture diagram](images/architecture.png)
*Editors work in Contentstack; the Next.js storefront on Vercel composes Contentstack content with BigCommerce commerce data. The editable source is `images/source/architecture.html`.*

<details>
<summary>Text version of the diagram</summary>

```
                          ┌────────────────────────── Editors ───────────────────────────┐
                          │ Contentstack app: entry form + Live Preview / Visual Editor  │
                          └───────────────┬───────────────────────────────▲──────────────┘
                                          │ publish                       │ iframe (preview)
                                          ▼                               │
   ┌──────────────────────────┐   ┌────────────────────┐      ┌───────────┴────────────┐
   │ Contentstack (EU)        │   │ BigCommerce        │      │ Next.js 16 storefront  │
   │ • 10 content types       │   │ "commerce b2b"     │      │ proxy.ts → [locale]    │
   │ • locales en-us, fr-fr   │   │ headless channel │◄─────┤ Server Components      │
   │ • env "preview"          │◄──┤ catalog, prices,   │ GQL  │ Server Actions (cart)  │
   └──────────────▲───────────┘   │ carts, checkout    │      │ small Client Components│
                  │ Delivery SDK  └────────────────────┘      └───────────┬────────────┘
                  └───────────────────────────────────────────────────────┘
                                                                           ▼
                                                                  Visitors (EN at /, FR at /fr)
```

</details>

Two systems of record, one composition layer:

| Concern | Lives in | Why |
|---|---|---|
| Pages, articles, guides, FAQs, banners, navigation, announcements, product *storytelling* | Contentstack | Editors own wording, imagery, structure and translations |
| Catalog, categories, brands, prices, stock, carts, checkout | BigCommerce | Commerce data must stay authoritative and live |
| Product spotlight ↔ product link | `product_spotlight.bc_product_id` | Editorial content is *keyed* to a product ID; price and stock are never copied into the CMS |

## Technology

| Layer | Choice |
|---|---|
| Framework | Next.js 16.3 (App Router, Turbopack), React 19.2, TypeScript |
| Styling | Tailwind CSS v4 + CSS custom properties (see [design-system.md](design-system.md)) |
| Content | `@contentstack/delivery-sdk` 5.6, `@contentstack/utils` 1.9 (JSON RTE → HTML, edit tags) |
| Editing | `@contentstack/live-preview-utils` 4.5 |
| Commerce | BigCommerce Storefront GraphQL API (plain `fetch`) |
| Fonts | Archivo (display, variable width) and IBM Plex Sans via `next/font/google` |
| Tooling | Python 3 + Pillow for the seeding scripts |

> The project's `AGENTS.md` warns that this Next.js version has breaking changes. The docs in
> `node_modules/next/dist/docs/` are the reference (e.g. `params` and `searchParams` are Promises, the middleware file is
> now `proxy.ts`).

## Request lifecycle

1. **`proxy.ts`** runs first. `/fr/...` passes through. `/en/...` redirects (308) to the clean URL. Every other path is
   *rewritten* internally to `/en/...`, so English keeps clean URLs while still matching `app/[locale]`.
2. **`app/[locale]/layout.tsx`** validates the locale, sets `<html lang>`, and renders the announcement bar, header
   (with the mega menu) and footer. These fetch their own data in parallel with the page.
3. **The page** (a Server Component) reads `params`/`searchParams`, fetches content from Contentstack and commerce data
   from BigCommerce in parallel (`Promise.all`), and renders HTML.
4. **Client Components** hydrate only where interaction is needed (listed below).
5. **Server Actions** handle cart mutations; they set the cart cookie and revalidate the layout so the header badge updates.

```
Browser ──► proxy.ts ──► app/[locale]/…page.tsx ──┬─► lib/site.ts, lib/blog.ts ──► Contentstack CDA
                                                  └─► lib/bigcommerce.ts       ──► BigCommerce GraphQL
```

## Rendering and caching

- Every page is **dynamically rendered**: it reads `searchParams` (preview, filters) and/or cookies (cart).
- **BigCommerce** reads use `fetch` with `next: { revalidate: 300 }` (5 minutes), except carts (`no-store`).
- **Contentstack** reads use the SDK (Axios), which Next does not cache, so each request reads the CDN. In
  production, add publish webhooks plus tag-based caching if load requires it (see [decisions.md](decisions.md)).
- In **preview**, a fresh stack instance is created per request (the SDK's `livePreviewQuery` mutates the instance).

## Client Components (the only JavaScript that ships for interaction)

| Component | Purpose |
|---|---|
| `LivePreview` | initialises the Live Preview / Visual Editor SDK |
| `LocaleSwitcher` | links to the same page in the other language |
| `MegaMenu` | hover/click product menu |
| `PlpForm`, `SearchBox`, `PriceRange`, `SortSelect` | auto-applying filters and search-as-you-type |
| `ProductGallery`, `AddToCart` | product page interaction |
| `CartView`, `QtyStepper` | optimistic cart editing |

Everything else is server-rendered HTML.

## Data model at a glance

```
page ──hero──► hero_banner                       blog_listing_page ──page_components──► hero_banner, blog_landing_page
blog_landing_page ──author──► author             buying_guide ──author──► author
blog_landing_page ──related_post──► blog_landing_page     buying_guide ──related_faqs──► faq
product_spotlight ··bc_product_id·· BigCommerce product    buying_guide ··recommended_bc_products·· BigCommerce products
announcement_bar    site_navigation (singleton)
```

References (`──►`) are Contentstack references; dotted links (`··`) are plain IDs resolved at request time against
BigCommerce, so a deleted or renamed product never breaks a content entry.

## Security model

- Tokens are server-side only (no `NEXT_PUBLIC_` variables). The storefront needs only **read** access to Contentstack
  (delivery token, plus the preview token for drafts) and a **scoped** BigCommerce Storefront token.
- The BigCommerce Storefront token is created per **origin** and per **channel**. It expires (90 days by default).
- The **management token** exists only for the seeding scripts.
- `Content-Security-Policy: frame-ancestors` allows only Contentstack's editor to embed the site.
- Edit tags and the editing SDK load only in preview or local development (`EDIT_MODE`), so production HTML carries no
  editing markup.
- Rich text from Contentstack and BigCommerce is rendered with `dangerouslySetInnerHTML`. Both are trusted,
  editor-controlled sources; do not render visitor-supplied HTML this way.
