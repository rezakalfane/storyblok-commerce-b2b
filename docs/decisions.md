# Decisions

Short records of the choices that shape the project: what was decided, why, and what was rejected. Newest context last
within each theme.

## Architecture

### D1. Contentstack for content, BigCommerce for commerce; keyed by ID
**Decision.** Editorial content lives in Contentstack; catalog, prices, stock and carts stay in BigCommerce. Content links
to products by **product ID / SKU** (`product_spotlight.bc_product_id`, `buying_guide.recommended_bc_products`), resolved at
request time.
**Why.** Prices and stock must never go stale or be copied into a second system. Deleting a product only removes a card.
**Rejected.** Syncing products into Contentstack (duplication and drift); storing prices in content.

### D2. Server Components first; JavaScript only for interaction
**Decision.** Pages render on the server; a handful of small Client Components (filters, cart, mega menu, gallery, editing
SDK) handle interaction.
**Why.** Fast first paint, simple data flow, and the Live Preview SSR mode works without client-side data fetching.

### D3. Storefront GraphQL, not the REST Management API, for the storefront
**Decision.** Read catalog and run carts through the **Storefront GraphQL API** with a channel-scoped token.
**Why.** It respects channel visibility, customer-group rules and guest pricing, is safe on the server with a narrow
token, and supports faceted search. The Management API (admin token) is for administration only.

## Content model

### D4. Keep FAQ, drop Case Study (the 10-type cap)
**Decision.** The free plan allows 10 content types. When navigation needed a slot, the empty `case_study` type was
deleted and `faq` kept.
**Why.** FAQs answer real buyer questions (credit, delivery, fitment) and are reused by guides; case studies are marketing
content the blog already covers. The type was empty, so nothing was lost.

### D5. UI strings in code, not in Contentstack
**Decision.** Button and label text live in `lib/i18n.ts`.
**Why.** A "UI strings" content type would have used another of the 10 slots. The dictionary is type-checked so a missing
French string is a compile error.
**Consequence.** Editors cannot change UI labels without a developer; marketing copy (heroes, banners, nav) *is* in the CMS.

### D6. Select-field values stay English; display is mapped
**Decision.** FAQ topics, guide audiences and spotlight badges store fixed English values and are translated for display.
**Why.** Contentstack select choices are not localizable.
**Consequence.** Adding a choice means editing the schema and the label maps.

### D7. Category photo tiles are static
**Decision.** The five home-page category tiles use files in `public/images/categories/` with labels from `lib/i18n.ts`.
**Why.** Contentstack had no free content-type slot for them. They match the BigCommerce category tree one-to-one.
**Alternative later.** A `category_tile` type (or reuse `block`) if editors need to change them.

## Internationalization

### D8. English at clean URLs, French under `/fr`; rewrite, not redirect
**Decision.** `proxy.ts` rewrites unprefixed paths to `/en/…` and redirects `/en/…` to the clean URL.
**Why.** Keeps existing URLs stable for the default language while using one `[locale]` route tree.
**Rejected.** `/en` prefix for English (changes all URLs); sub-domains (needs DNS/hosting setup).

### D9. Shared slugs across languages
**Decision.** `/fr/blog/<english-slug>`.
**Why.** The language switcher is exact (swap the prefix), `url` stays equal between master and localized entries, and no
slug-mapping step is needed.
**Trade-off.** Less SEO benefit than translated slugs. The alternative needs per-locale slug lookup in the switcher and in
`generateStaticParams`.

### D10. Fallback to English for untranslated entries
**Decision.** `includeFallback()` on every read.
**Why.** A partially translated site is better than gaps. Missing translations are visible to editors because the page
shows English.

### D11. Product text stays English until BigCommerce translates it
**Decision.** Do not machine-translate product names or copy in code.
**Why.** Product data belongs to BigCommerce. The client already sends `Accept-Language`, so Store Translations will light up
without code changes.

## Editing

### D12. SSR live preview, not client-side rendering
**Decision.** `ssr: true`: the preview pane re-requests HTML after each edit.
**Why.** Our pages are Server Components. CSR mode would need client-side data fetching and a parallel rendering path for
every page.
**Trade-off.** Each edit is a server render (slower than CSR), but there is one code path.

### D13. `<meta>` page context instead of `setPageContext`
**Decision.** Declare the entry with `contentstack:entry-uid` / `contentstack:content-type-uid` meta tags.
**Why.** `setPageContext` posts a message that logs an error when there is no Visual Builder to acknowledge it (Timeline
mode). Meta tags are the SDK's documented alternative.

### D14. Edit tags only in preview
**Decision.** `tagEntry()` is a no-op without preview parameters; the SDK loads only in preview or development.
**Why.** Production HTML should carry no editing markup.

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
**Consequence.** Localized entries are copies, so the scripts must be re-run in order (English first, then French).

### D25. Assets replaced in place
**Decision.** An upload whose filename already exists replaces that asset's file (same UID).
**Why.** Reusing the old file silently ignored updated crops; creating a new asset would orphan every reference.

### D26. All sample content is fictional
**Decision.** Authors, article text, FAQ policies, delivery claims and contact details are placeholders (`example.com`).
**Why.** Nothing in the site should be mistaken for real policy or real people. Replace before launch.

### D27. Review gate: staging site plus a workflow and publishing rule
**Decision.** Edits are published to `preview` and checked on a public staging site (branch `staging`); a Contentstack workflow
(Draft, In review, Approved) with a publishing rule lets only **Approved** entries reach `production`.
**Why.** The gate is enforced by Contentstack, not by habit, and costs nothing on the free plan. A Release was rejected as the
only gate because it does not block a direct publish. **Known limits** (editing an Approved entry keeps its stage, self-approval
with one admin, code is not gated) are listed in [workflow.md](workflow.md).

### D28. Staging is public and rebuilt by an empty commit
**Decision.** Vercel deployment protection is off for previews, and a GitHub Action rebuilds `staging` from `main` with an empty
commit on every push.
**Why.** Contentstack's Live Preview iframe and reviewers need to open the URL without a Vercel login (Vercel adds `noindex`).
Vercel skips a branch whose tip it already built, so the empty commit forces a fresh deployment.

## Open questions

- Will buyers **sign in** (B2B Edition companies, price lists, quotes)? Today "your negotiated prices" is aspirational copy.
- Do we want **translated slugs** for French SEO (reverses D9)?
- Should category tiles and the home category mosaic move into Contentstack (needs a type slot)?
- Publish **webhooks and caching** for Contentstack reads at production traffic.
