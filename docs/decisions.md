# Decisions

Short records of the choices that shape the project: what was decided, why, and what was rejected. Newest context last
within each theme.

## Architecture

### D1. Storyblok for content, BigCommerce for commerce; keyed by ID
**Decision.** Editorial content lives in Storyblok; catalog, prices, stock and carts stay in BigCommerce. Content links
to products by **product ID / SKU** (`product_spotlight.bc_product_id`, `buying_guide.recommended_bc_products`), resolved at
request time.
**Why.** Prices and stock must never go stale or be copied into a second system. Deleting a product only removes a card.
**Rejected.** Syncing products into Storyblok (duplication and drift); storing prices in content.

### D2. Server Components first; JavaScript only for interaction
**Decision.** Pages render on the server; a handful of small Client Components (filters, cart, mega menu, gallery, editing
bridge) handle interaction.
**Why.** Fast first paint, simple data flow, and the Visual Editor works with server rendering (the bridge asks the server to re-render) without client-side data fetching.

### D3. Storefront GraphQL, not the REST Management API, for the storefront
**Decision.** Read catalog and run carts through the **Storefront GraphQL API** with a channel-scoped token.
**Why.** It respects channel visibility, customer-group rules and guest pricing, is safe on the server with a narrow
token, and supports faceted search. The Management API (admin token) is for administration only.

## Content model

### D4. Hero banners are blocks inside the page, not separate stories
**Decision.** In Storyblok a `hero_banner` is a nestable block in `page.hero` and `blog_listing_page.hero`. In the ContentStack version it was a
separate entry referenced by the page (and the free plan's 10-type cap shaped other choices).
**Why.** A hero is used once; a block is edited in place in the Visual Editor, needs no reference to resolve, and cannot be orphaned.
**Consequence.** Reusing one hero on several pages means copying it; promote it to a story if that becomes common.

### D5. UI strings in code, not in Storyblok
**Decision.** Button and label text live in `lib/i18n.ts`.
**Why.** The dictionary is type-checked so a missing French string is a compile error, and these strings are product UI rather than editorial content.
**Consequence.** Editors cannot change UI labels without a developer; marketing copy (heroes, banners, nav) *is* in the CMS.

### D6. Select-field values stay English; display is mapped
**Decision.** FAQ topics, guide audiences and spotlight badges store fixed English values and are translated for display.
**Why.** Storyblok option values are not translated.
**Consequence.** Adding a choice means editing the schema and the label maps.

### D7. Category photo tiles are static
**Decision.** The five home-page category tiles use files in `public/images/categories/` with labels from `lib/i18n.ts`.
**Why.** They match the BigCommerce category tree one-to-one and rarely change.
**Alternative later.** A `category_tile` block on the home `page` if editors need to change them.

## Internationalization

### D8. English at clean URLs, French under `/fr`; rewrite, not redirect
**Decision.** `proxy.ts` rewrites unprefixed paths to `/en/…` and redirects `/en/…` to the clean URL.
**Why.** Keeps existing URLs stable for the default language while using one `[locale]` route tree.
**Rejected.** `/en` prefix for English (changes all URLs); sub-domains (needs DNS/hosting setup).

### D9. Shared slugs across languages
**Decision.** `/fr/blog/<english-slug>`.
**Why.** The language switcher is exact (swap the prefix), one story serves both languages, and no slug-mapping step is needed.
**Trade-off.** Less SEO benefit than translated slugs. The alternative needs per-locale slug lookup in the switcher and in
`generateStaticParams`.

### D10. Field-level translation, with fallback to English per field
**Decision.** Translations live in the same story (`field__i18n__fr`) rather than in `fr/` folders of duplicated stories.
**Why.** Editors translate next to the English text, a story is published once for all languages, references and images are shared, and an
untranslated field returns the default value, so a partially translated site has no gaps.
**Rejected.** Folder-level translation (one copy of every story per language): it duplicates structure and every non-text field.
**Trade-off.** Publishing is all-or-nothing across languages.

### D11. Product text comes from BigCommerce Store Translations; URLs stay shared
**Decision.** Do not translate product names or copy in code. Read translated content from the Storefront API with an
`@shopperPreferences(locale: "fr")` directive (it ignores `Accept-Language`), and keep the English slugs in every language by
restoring each `path` from the default-locale catalog (see [bigcommerce.md](bigcommerce.md)).
**Why.** Product data belongs to BigCommerce. Translated URL paths (`/produits/...`) would need route, language-switcher and hreflang
changes (reverses D9) and a product path only resolves in its own language.
**Consequence.** A French product page costs one extra read (resolve the English path, then the translated content by id), and French
listings add one cached lookup of English paths.

## Editing

### D12. Server-rendered live preview, not client-side rendering
**Decision.** Keep the Server Components. The Storyblok bridge (via `StoryblokLiveEditing`) sends the unsaved story to a server action that
stores it and revalidates the page; the server renders from it.
**Why.** One rendering path for the site and the editor, with no client-side data fetching.
**Trade-off.** Each keystroke is a server render, and the live-edit cache is per process (intermittent on serverless; Save always reloads).
**Rejected.** Registering one React component per Storyblok component and rendering client-side: it would replace the page components and
the BigCommerce composition.

### D13. Keep the page components; map stories to the existing shapes
**Decision.** `lib/blog.ts` and `lib/site.ts` map stories into the shapes the ContentStack version used, so the UI is unchanged.
**Why.** The goal was the same UI on a different CMS. The mapping layer is the only place that knows about Storyblok.

### D14. Draft mode only for signed editor requests; edit attributes only in preview
**Decision.** Drafts are served only when `_storyblok` comes with a valid `_storyblok_tk` signature; `editTags()` is empty otherwise; the
bridge loads only in the editor iframe. The live site reads published content with the **Public** token.
**Why.** `?_storyblok=1` must not reveal unpublished content, and production HTML should carry no editing markup.

## Catalog

### D15. A category lists its subcategories' products
**Decision.** Category pages use faceted search by `categoryEntityId` rather than `category.products`.
**Why.** Products are assigned to subcategories; the category's own list is empty, which made category pages blank.

### D16. Facets chosen by coverage, capped at 8 values
**Decision.** Brand plus Technology (93% of products), Voltage (89%), Warranty (66%); every facet shows ≤ 8 values and keeps
selected ones visible. Capacity range (54%) and Format (26%) were rejected.
**Why.** A filter that applies to a minority of products misleads. Long value lists (25 technologies) are noise.

### D17. The listing is a GET form that navigates on change
**Decision.** Filters are an HTML `<form method="get">`; JavaScript intercepts changes and calls `router.push` with
`{ scroll: false }`.
**Why.** Every state is a shareable, crawlable URL; it works without JavaScript; there is no client-side filter state to
keep in sync with the server. Chips and clear-all are plain links.
**Details.** Checkbox `key`s include their selected state and the search/price inputs reconcile with the URL, so removing a
chip resets the controls.

### D18. Search starts at 3 characters
**Decision.** Search-as-you-type is debounced (350 ms) and ignores 1–2 characters (with a hint).
**Why.** One or two characters match too broadly and cause needless requests.

## Cart

### D19. Cart state in BigCommerce; hosted checkout
**Decision.** The browser stores only the cart ID in an httpOnly cookie; checkout uses BigCommerce's hosted checkout URL.
**Why.** No payment or PII handling in this app; carts are shared with BigCommerce tooling and persist across devices only
via the cookie (guest carts).

### D20. Optimistic quantity editing
**Decision.** Update totals immediately, save after 500 ms, reconcile with `router.refresh()`.
**Why.** Quantity buttons feel instant; a failed save shows an error and the next refresh restores the server's numbers.

## Design

### D21. "Workbench": light, photographic, one accent
**Decision.** Cool steel and ink with terminal amber; Archivo + IBM Plex Sans; open product tiles; 1100 px pages.
**Why.** Fits a trade supplier (practical, legible, photography-led) and avoids the usual generated-site defaults. See
[design-system.md](design-system.md).
**Rejected.** Dark theme; cream with a warm accent; boxed shadowed cards.

### D22. Photography policy
**Decision.** Use only text-free photos from pilesbatteries.com (with the owner's permission); never bake titles into images;
guide heroes use photography, not composed product shots.
**Why.** Titles in images cannot be translated, edited or read by screen readers. Product images come from BigCommerce.

### D23. Amber is never body or heading text on white
**Decision.** Amber is for fills, underlines and rules.
**Why.** Amber on white measures 2.3:1, which fails WCAG. (Step numbers were changed from deep amber to ink after a contrast check.)

## Process

### D24. Idempotent Python seeders instead of manual entry
**Decision.** All sample content is generated from data files and pushed through the Management API.
**Why.** Reproducible, reviewable and re-runnable: schema, English, translations and images can be refreshed together.
**Consequence.** Each story is written whole (a `PUT` replaces its content), so manual edits to seeded stories are overwritten on the next run.

### D25. Assets reused by file name
**Decision.** An image whose file name already exists in Assets is reused, not uploaded again.
**Why.** Re-running the seed must not create duplicates. To change an image, replace the asset in Storyblok or use a new file name.

### D26. All sample content is fictional
**Decision.** Authors, article text, FAQ policies, delivery claims and contact details are placeholders (`example.com`).
**Why.** Nothing in the site should be mistaken for real policy or real people. Replace before launch.

### D27. No approval gate (yet)
**Decision.** Editors review with the Visual Editor's draft preview and then publish; there is no workflow stage or publishing rule.
**Why.** The ContentStack version enforced Draft, In review and Approved with a publishing rule. Storyblok has no environments to gate, and
its workflows are a separate feature; the base port keeps publishing simple.
**Later.** Configure a Storyblok workflow (stages and who may publish) if review is required.

### D28. Staging is public and rebuilt by an empty commit
**Decision.** Vercel Authentication is off, and a GitHub Action rebuilds `staging` from `main` with an empty commit on every push.
**Why.** The Visual Editor iframe and reviewers need to open the URL without a Vercel login. Vercel skips a branch whose tip it already
built, so the empty commit forces a fresh deployment.

## Open questions

- Will buyers **sign in** (B2B Edition companies, price lists, quotes)? Today "your negotiated prices" is aspirational copy.
- Do we want **translated slugs** for French SEO (reverses D9)?
- Should the category tiles and home mosaic move into Storyblok?
- A **publish webhook** to revalidate the `storyblok` cache tag, and an approval workflow.
