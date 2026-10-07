# Commerce B2B storefront

**Live:** https://storyblok-commerce-b2b.vercel.app (English) and https://storyblok-commerce-b2b.vercel.app/fr (French)

A headless B2B storefront for trade batteries. **Content** (pages, articles, guides, FAQs, navigation, banners) lives in
**Storyblok**; the **catalog, prices and cart** live in **BigCommerce**; **Next.js 16** (App Router) composes them.
The site is bilingual (English at `/`, French at `/fr`) and editors can edit it visually in Storyblok's Visual Editor.

This is the same storefront as the ContentStack and Amplience versions (same pages, images and UI), with Storyblok as the CMS.

![Commerce B2B homepage: photo hero, category mosaic and CMS-driven content, in the Workbench light theme](docs/images/homepage.jpg)

```
  Storyblok (EU)                  BigCommerce (headless channel)
  content, 2 languages            catalog, prices, cart, checkout
        │  Content Delivery API           │  Storefront GraphQL
        └──────────────┐      ┌──────────┘
                       ▼      ▼
                 Next.js 16 storefront  ──►  Visitors (EN / FR)
                       ▲
             Visual Editor (editors)
```

## What is in it

| Area | What you get |
|---|---|
| **Home** | CMS-driven hero with a staggered photo pair, shop-by-category mosaic, value blocks, trade favourites, guides |
| **Catalog** | Mega menu from the live category tree; listing and category pages with search-as-you-type, sort, and brand / technology / voltage / warranty / price filters; filters apply on click and show as removable chips |
| **Product page** | Gallery, price, stock, key specs, volume pricing, description, spec table, related guides and products, structured data |
| **Cart** | Add to cart, dynamic quantity stepper with instant totals, remove, hosted checkout hand-off |
| **Content** | Blog (36 articles, 6 authors), 6 buying guides, 15 FAQs, banners, announcement bar, navigation |
| **Languages** | English and French: routes, UI text, prices, dates and all Storyblok content (field-level translation) |
| **Editing** | Storyblok Visual Editor: click a block to edit it, live updates while typing, English and French |
| **Design** | "Workbench": light theme, 1100px pages, photography-led |

## Screenshots

<table>
<tr>
<td width="50%"><img src="docs/images/plp.jpg" alt="Product listing with search and filter chips"><br><sub>Listing: search-as-you-type, removable filter chips, facets from BigCommerce</sub></td>
<td width="50%"><img src="docs/images/pdp.jpg" alt="Product page"><br><sub>Product page: gallery, price, stock, key specs, add to cart</sub></td>
</tr>
<tr>
<td><img src="docs/images/cart.jpg" alt="Cart with quantity steppers"><br><sub>Cart: instant quantity changes, saved to BigCommerce</sub></td>
<td><img src="docs/images/i18n-en-fr.jpg" alt="The same product page in English and French"><br><sub>The same page in English and French</sub></td>
</tr>
<tr>
<td><img src="docs/images/mega-menu.jpg" alt="Product mega menu"><br><sub>Mega menu built from the live category tree</sub></td>
<td><img src="docs/images/guide.jpg" alt="Buying guide"><br><sub>Buying guide with numbered steps and recommended products</sub></td>
</tr>
<tr>
<td><img src="docs/images/home-fr.jpg" alt="The French home page"><br><sub>The French home page: content from the same Storyblok stories</sub></td>
<td><img src="docs/images/blog-post.jpg" alt="Blog post"><br><sub>A blog post: rich text from Storyblok plus an author card</sub></td>
</tr>
</table>

## Quick start

Requirements: Node 22+, Python 3.12+ with Pillow (only for the seeding scripts), a Storyblok space and a BigCommerce
store with a storefront channel.

```bash
cd storefront
npm install
cp .env.example .env.local      # then fill in the values (see docs/operations.md)
npm run dev                     # http://localhost:3000   (French: /fr)
```

Common commands:

```bash
npm run dev          # development server (Turbopack)
npm run dev:https    # same over HTTPS, needed to edit in the Storyblok Visual Editor
npm run lint         # ESLint
npx tsc --noEmit     # type-check
npm run build        # production build

# Model and seed the space (idempotent; needs STORYBLOK_OAUTH_TOKEN)
python3 scripts/seed/schemas.py      # French language + components (content model)
python3 scripts/seed/seed.py         # images and 76 stories, English + French, published
python3 scripts/seed/editor.py       # Visual Editor preview environments and real paths
```

## Project layout

```
app/
  [locale]/                  every page lives under the locale segment
    layout.tsx               html lang, announcement bar, header (mega menu), footer
    page.tsx                 home
    blog/  guides/  faq/     content pages (+ [slug] detail pages)
    products/                listing, and [...slug] for categories and product pages
    cart/                    cart
  actions/cart.ts            server actions: add to cart, set quantity, remove
  globals.css                design tokens and base/component styles
proxy.ts                     locale routing (English rewritten to /en, French under /fr)
components/                  UI building blocks (cards, hero, mega menu, filters, cart…)
lib/
  storyblok.ts               Delivery API client, draft/published, signed editor check, edit attributes
  site.ts  blog.ts           typed content fetchers (stories mapped to the shapes the pages use)
  bigcommerce.ts             Storefront GraphQL: products, categories, search, cart
  i18n.ts                    locales, URL helpers, UI strings, label maps
scripts/seed/                content model, seeders, Visual Editor setup, French translations, photos
docs/                        documentation (start at docs/README.md)
HISTORY.md                   every request and its result
```

## Documentation

Start with **[docs/README.md](docs/README.md)**. Highlights:

- [Architecture](docs/architecture.md): how the pieces fit, routing, rendering and caching
- [Implementation details](docs/implementation.md): how each feature works
- [Storyblok](docs/storyblok.md): the space, tokens, the content model, reading and publishing
- [Visual Editor](docs/visual-editor.md): signed preview URLs, live editing, languages, troubleshooting
- [BigCommerce](docs/bigcommerce.md): channel, token, queries, listing, cart
- [Internationalization](docs/i18n.md): locales, URLs, translation workflow
- [Seeding](docs/seeding.md): sample content scripts
- [Design system](docs/design-system.md): tokens, type, components
- [Operations](docs/operations.md): environment variables, deployment, troubleshooting
- [Decisions](docs/decisions.md): why things are the way they are

## Important notes

- **All sample content is fictional.** Author names, article text, FAQ policies, delivery claims and the
  `example.com` contact details are placeholders. Replace them before going public.
- **Product, category and custom-field text is translated by BigCommerce** (Store Translations) and read with the locale
  directive, with BigCommerce's translated catalog URLs (`/products/...`, `/fr/produits/...`) and a language switcher that finds the
  matching page. UI text, navigation and fallbacks live in `lib/i18n.ts`.
- The Storyblok space is on a **trial plan** that ends around 21 November 2026; confirm a plan for continued use.
- Secrets live only in `.env.local` (gitignored). The personal access token is used by the seeding scripts, never by the
  running storefront; the live site reads published content with the Public token.
