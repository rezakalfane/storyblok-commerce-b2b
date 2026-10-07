# Implementation details

How each feature works and where to find it. Paths are relative to the repository root.

## 1. Data layer

### Content model and facade: `core/content.ts`, `lib/content.ts`

`core/content.ts` is the content model every page and component reads: `Block` (hero, text, image, video, feature, categories, spotlights, guides,
posts, postListing, guideListing, faqs), `Page` (a title, a description and its blocks), `Post` (with its own blocks), `Guide`, `Faq`,
`Spotlight`, `Navigation`, `Announcement`, `Author`. Every entity may carry `$` (edit attributes, empty outside the editor). `lib/content.ts` is the
facade the pages call (`getPage(key, locale)`, `getPosts`, `getPost(slug)`, `getGuides`, `getGuide(slug)`, `getSpotlights`, `getNavigation`,
`getAnnouncement`); it reads through the Storyblok provider. The same model and components are used by the private switchable project
`content-commerce-b2b`; this repository is that code reduced to Storyblok only.

### Storyblok: `providers/cms/storyblok/`

- **`client.ts`**: `getStory(slug, locale, draft, relations)` and `getStories(params, locale, draft, relations)` are the only entry points for reading
  (plain `fetch` against the Delivery API). They pick the language (`default` / `fr`), the token and `version` (published with the Public token, or draft
  with the Preview token), resolve the requested `component.field` relations, and return the stories plus a map of the related stories (`rels`, by
  uuid). Missing stories return `undefined` (pages call `notFound()`). `per_page` is added to list requests only (a single-story request with
  `per_page` returns 422). Helpers: `asset`, `html` (rich text via `@storyblok/richtext`), `lines`, `csv`, `toIso`, `rel` / `relList` (a relation
  field is a uuid, or the story itself when the Visual Editor resolved it).
- **`mapper.ts`** turns stories into the content model: `getPage(key)` reads the story `pages/<key>` and maps each inline block (`hero_banner`,
  `feature_block`, `text_block`, `image_block`, `video_block`, `collection_block` by `kind`) to a `Block`; posts, guides, FAQs, spotlights, navigation
  and announcements are mapped too (assets become `{ url, alt }`, `cta_label` + `cta_href` become `{ label, href }`, one-per-line text becomes
  arrays, rich text becomes HTML). Authors are fetched once per request (`getAuthorMap`) and joined by uuid.
- **`index.ts`** is the provider: each function reads `isPreviewRequest()` (the proxy's verified `x-preview` header) to choose draft or published.
- **Edit tags:** `editTags(blok, story, draft)` returns the Visual Editor attributes for a block (empty unless the request is a verified preview); it
  is stored as `$` on the mapped content and spread by the components with `tag(entity, field)` (`core/edit.ts`).
- **Live edits:** `setLiveStory` keeps the unsaved story sent by the bridge (5 minutes, in memory) and `withLive` applies it, with the active language,
  to draft reads ([visual-editor.md](visual-editor.md)).
- Detail stories are looked up by **full slug** (`blog/<slug>`, `guides/<slug>`). Slugs are identical in every language (see
  [decisions.md](decisions.md)).

### BigCommerce: `lib/bigcommerce.ts`

A thin GraphQL client (`gql()`), the query fragments, and typed functions. Details in [bigcommerce.md](bigcommerce.md).

## 2. Pages

| Route | File | Data |
|---|---|---|
| `/` | `app/[locale]/page.tsx` | the Page with key `home` (story `pages/home`): its blocks |
| `/faq`, `/guides`, `/blog`, any page an editor adds | `app/[locale]/[...slug]/page.tsx` | the Page with that key (story `pages/<key>`): its blocks |
| `/blog/[slug]` | `blog/[slug]/page.tsx` | one `blog_post` (its `content` blocks) + author + related reading |
| `/guides/[slug]` | `guides/[slug]/page.tsx` | `buying_guide`, related FAQs, live BigCommerce products |
| `/products`, `/fr/produits` | `products/page.tsx` | BigCommerce faceted search over the whole catalog |
| `/products/<category>…`, `/fr/produits/<categorie>…` | `products/[...slug]/page.tsx` | category **or** product (see below) |
| `/cart` | `cart/page.tsx` | BigCommerce cart |

`components/page-content.tsx` loads the Page and `components/page-blocks.tsx` renders its blocks top to bottom, one view per block type (consecutive
`feature` blocks share a band). The routes with their own file take precedence over the catch-all. Whether a request is a Visual Editor preview is
decided by `proxy.ts` (the `x-preview` header), and `<EditSupport>` in the layout loads the Storyblok bridge for it.

### The catalog routes

BigCommerce translates catalog URLs, so the catalog lives at `/products/...` in English and `/fr/produits/...` in French (the root category
"Products" is "Produits" in French, and every category and product slug below it is translated too). The routes are
`app/[locale]/products/page.tsx` (listing) and `app/[locale]/products/[...slug]/page.tsx` (category or product). The route is static (`products`);
`proxy.ts` rewrites another language's catalog root onto it (`/fr/produits/...` to `/fr/products/...`) and passes the requested root in the
`x-catalog-root` header, which the page reads with `requestedCatalogRoot()` (`lib/catalog-route.ts`). The roots are `CATALOG_ROOT` in `lib/i18n.ts`.
This keeps the catch-all `[...slug]` Page route free of a competing dynamic segment.

- The page rebuilds the BigCommerce path from the requested root and the slug (`/produits/batteries-automobiles/...`) and resolves it **in the page's
  language**: a path only resolves in its own language. **One or two segments are categories, three or more are products.** If the guess is
  wrong the other interpretation is tried, and `notFound()` is raised if neither resolves.
- `ensureCatalogRoot()` (`lib/catalog-route.ts`): another language's root (an old or content-stored link such as `/fr/products/...`) is
  **permanently redirected** to the same page in this language; any other first segment is a 404.
- Product and category reads include `locales`, BigCommerce's list of the page's path in every language. It feeds `hreflang` / canonical
  tags (`alternatesFromPaths`) and the language switcher.
- **Language switcher:** on a catalog page it links to `/api/switch-locale?to=fr&path=<current path>`, which looks up the page's path in the
  target language and redirects (307), keeping the other query parameters and dropping attribute filters (`f.*`, whose values are translated).
  Other pages just swap the `/fr` prefix.
- `localePath(locale, "/products")` (the bare catalog link used in navigation, footer, buttons and breadcrumbs) maps to the language's root.
  Tiles and the mega menu use the translated paths from the category tree; tile photos are matched by category id.

## 3. Home page

The Page with key `home` (story `pages/home`) drives it. It is an ordered list of blocks; the seeded page has:

- **Hero** (`components/hero.tsx`, `variant="home"`): headline, description and button come from the `hero_banner` block; its `image` and `second_image`
  are the two staggered photos (both selectable in the Visual Editor). A secondary "All products" button is added in code.
- **Intro**: a `text_block` (rich text).
- **Shop by category** (`categories` collection, `components/category-tiles.tsx`): the five top-level catalog categories as a photo mosaic. The
  photos are static files in `public/images/categories/`; labels are localized (`categoryLabel`).
- **Value blocks**: three `feature_block`s (title, copy, image, layout `image_left` / `image_right`).
- **Trade favourites**: a `spotlights` collection (three `product_spotlight` stories), enriched with live BigCommerce price, photo and link.
- **From the buying guides**: a `guides` collection (the first three guides).

Editors can reorder, add and remove these blocks; the page renders whatever list it receives.

![Trade favourites](images/home-spotlights.jpg)
*Trade favourites: editorial content from Storyblok with live price, photo and link from BigCommerce.*

![A value block](images/home-blocks.jpg)
*A value block (a `feature_block`: title, copy, image, layout).*

![From the buying guides](images/home-guides.jpg)
*The guides strip: the first three guides, with photo, audience and read time.*

## 4. Navigation, mega menu and announcement bar

- **Header links** come from the `site_navigation` story (`settings/navigation`). The link whose `href` is `/products` is replaced by the
  **mega menu**.
- **Mega menu** (`components/mega-menu.tsx`, columns built in `components/site-chrome.tsx → megaColumns`): the live
  BigCommerce category tree (top level with subcategories and product counts), localized labels and a photo per top-level
  category. Hover previews it; a click pins it open; Escape, an outside click or navigating closes it. The panel is
  absolutely positioned under the header.
- **Announcement bar**: the first `announcement_bar` that is active, inside its date window and aimed at guests
  (`audience` is `everyone` or `guests`); style `info` (ink), `promo` or `warning` (amber).
- **Footer** columns, contact details and legal line come from `site_navigation`.
- **Cart link** shows the item count by reading the cart cookie and asking BigCommerce (`CartLink`, in a `Suspense`).

![Product mega menu](images/mega-menu.jpg)
*The mega menu: five top-level categories with photos, subcategories and live product counts.*

## 5. Product listing and categories

`components/plp.tsx` renders: search box, result count, **active filter chips**, "Clear all", sort, facets, product
grid and pager. It is a plain GET `<form>`, wrapped by `components/plp-form.tsx`.

![Product listing](images/plp.jpg)
*A category with a search term and a technology filter applied: result count, chips with "Clear all", sort, facets, product grid.*

### Query parameters

| Parameter | Meaning |
|---|---|
| `q` | search text (3+ characters) |
| `brand` (repeatable) | brand entity IDs |
| `f.Technology`, `f.Voltage`, `f.Warranty` (repeatable) | attribute facet values |
| `min`, `max` | price range |
| `sort` | `featured` (default), `newest`, `best_selling`, `price_asc`, `price_desc`, `name_asc` |
| `after` / `before` | cursor pagination |

`parseCatalogParams()` reads them; `searchCatalog()` runs the query ([bigcommerce.md](bigcommerce.md)).

### Interaction model

- **Filters apply on click.** `PlpForm` listens for checkbox changes, serialises the form to a URL and calls
  `router.push(url, { scroll: false })` inside `useTransition`. The grid dims (`group-data-[pending=true]:opacity-50`)
  while the server re-renders. Without JavaScript the form still works as a normal GET form (a `<noscript>` button).
- **Search as you type** (`components/search-box.tsx`): submits 350 ms after typing stops, only for 3+ characters (or
  when emptied). One or two characters show a hint and do nothing; Enter is ignored below three.
- **Price range** (`components/price-range.tsx`): applies 700 ms after typing stops.
- **Chips and "Clear all"** are server-rendered links computed from the current parameters. Removing a chip changes the
  URL; the checkboxes, search box and price inputs then **reset themselves** to match: checkboxes via a `key` that
  includes their selected state, the search box and price range by comparing the URL value with the last value they sent.
- **Cursors reset on any filter change** (only `after`/`before` links keep them), because a cursor is valid only for the
  same filters and sort.
- Each facet shows at most **8 values** (`MAX_FACET_VALUES`), most populated first, and always keeps selected values.
- On screens narrower than 1024 px the filter panel starts **collapsed** (`components/filters-details.tsx`) so the grid is
  visible first; it stays open on desktop and without JavaScript.

![Filter sidebar](images/plp-filters.jpg)
*The filter sidebar for a category: brand, technology, voltage and warranty facets (at most 8 values each) and a price range.*

### Categories include subcategory products

A category's own product list is often empty (products sit in subcategories). The category page therefore runs the
faceted search with `categoryEntityId`, which includes all descendants, instead of reading `category.products`.

## 6. Product detail page

`ProductView` in `products/[...slug]/page.tsx`:

![Product page](images/pdp.jpg)
*The product page: gallery, brand, price with stock indicator, spotlight tagline, key specs and add to cart.*

- **Gallery** (`product-gallery.tsx`): main image + thumbnails (client state).
- **Header**: brand, name, SKU / MPN, price (sale and retail "was" price when applicable), stock indicator.
- **Spotlight join**: if a `product_spotlight` story has `bc_product_id` equal to this product, its **tagline**, badge and
  **"Best for"** use cases appear. **Guides join**: guides whose `recommended_bc_products` contains the ID are listed.
- **Key specs** (Voltage, Capacity, CCA, Technology, Warranty) and the full **specification table** come from
  BigCommerce custom fields; names and common values are translated by `translateSpec()`.
- **Volume pricing** table renders when BigCommerce returns bulk-pricing tiers.
- **Add to cart** (`components/add-to-cart.tsx`) respects the product's min/max purchase quantity.
- **Related products** from BigCommerce's `relatedProducts`.
- **Structured data**: a `schema.org/Product` JSON-LD block (price, currency, availability, SKU, GTIN, brand, images).
- **Metadata**: title, description, Open Graph image and hreflang alternates.

![Description and specifications](images/pdp-details.jpg)
*Description, "Best for" use cases from the product spotlight, and the specification table from BigCommerce custom fields.*

## 7. Cart

- **State** lives in BigCommerce; the browser keeps only the cart ID in an httpOnly cookie `bc_cart_id` (30 days).
- **Server actions** (`app/actions/cart.ts`): `addToCartAction`, `setCartQuantityAction`, `removeFromCartAction`. Each
  creates the cart if needed, calls the BigCommerce mutation and `revalidatePath("/", "layout")` so the header badge refreshes.
- **`CartView`** (`components/cart-view.tsx`) edits optimistically:
  1. A quantity change updates the line total and the subtotal immediately.
  2. The save is debounced 500 ms per line; "Updating…" shows while anything is pending; checkout is disabled meanwhile.
  3. On success it calls `router.refresh()` to reload the server's numbers; on failure it shows an error and the server's
     numbers return on the next refresh. The subtotal shows the optimistic total until those fresh numbers arrive, so it never flashes
     the previous value in between.
  4. Removing is quantity 0 (saved immediately).
- **`QtyStepper`**: −, a typeable field (commits on blur/Enter), +; Arrow Up/Down keys; clamped to 1–999; accessible labels.
- **Checkout**: the cart's `redirectedCheckoutUrl` (BigCommerce hosted checkout) is created on each cart read.

![Cart](images/cart.jpg)
*The cart with quantity steppers: totals update instantly and save to BigCommerce after a short pause.*

## 8. Content pages

- **Blog**: the Page `blog` (hero, the latest articles, and a listing block with search: a text match over title and description, posted to the same
  URL); a post page renders its `content` blocks (text, image, video) in a main column with an author sidebar, and related posts. Dates and labels
  follow the locale.
- **Buying guides**: guide cards; guide page with numbered steps (a true sequence), pro tips, a checklist, related FAQs and
  **recommended products** that link to product pages with live price.
- **FAQ**: grouped by `topic` (the select value is English; `topicLabel()` shows the French label), native
  `<details>` accordions.

![A buying guide](images/guide.jpg)
*A buying guide: numbered steps, pro tips, a checklist panel and recommended products with live prices.*

![FAQ page](images/faq.jpg)
*The FAQ page: hero banner, then questions grouped by topic.*

![A blog post](images/blog-post.jpg)
*A blog post: main column plus an author card.*

## 9. Editing support

`components/edit-support.tsx` renders `providers/cms/storyblok/edit-support.tsx` (the client component `live-editing.tsx`) for requests the proxy verified
as an editor's preview (`x-preview`). Block attributes (`data-blok-c`, `data-blok-uid`) come from `$` on the mapped content and are spread with
`tag(entity, field)` on the key elements; a page's component list is wrapped in a `display: contents` element carrying the page's attributes. The
bridge sends the whole unsaved story on every change to the server action `liveEditUpdate`, which keeps it and calls `refresh()`. See
[visual-editor.md](visual-editor.md).

## 10. Internationalization

Routing in `proxy.ts`, strings and helpers in `lib/i18n.ts`. See [i18n.md](i18n.md).

## 11. Where to change things

| I want to… | Change |
|---|---|
| Edit wording, banners, FAQs, guides, nav, or reorder the blocks of a page | Storyblok (no code) |
| Add a UI string | `lib/i18n.ts` (`en` and `fr` objects, type-checked to match) |
| Add a filterable attribute | `FACET_NAMES` in `lib/bigcommerce.ts` (+ French label in `SPEC_NAMES_FR`) |
| Change the mega menu | `megaColumns()` in `components/site-chrome.tsx`, `components/mega-menu.tsx` |
| Change colours, type, spacing | tokens in `app/globals.css` |
| Add a page | a story under `pages/` (key = its slug); no code |
| Add a block type | a component in `tools/storyblok/schemas.py` (then run it), a `Block` variant in `core/content.ts`, a case in `providers/cms/storyblok/mapper.ts`, a view in `components/page-blocks.tsx`, edit tags |
