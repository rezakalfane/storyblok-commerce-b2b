# History

A chronological record of every request made while building the Storyblok version of this storefront, and what came out of it.
Prompts are quoted or condensed from the conversation. Dates are 2026.

> The storefront started as a copy of the ContentStack version (`contentstack-commerce-b2b`), which was itself modelled on the
> Amplience one; the history of that build lives in its own repository. **Result** is a summary of what was actually delivered.
> Things that were investigated and rejected, or that turned out different from the first attempt, are called out because they
> explain later decisions.

---

## 7 October

### 1. Start: migrate the ContentStack storefront to Storyblok
**Prompt:** Same UI (pages, images…) as the Amplience and ContentStack demos, connected to BigCommerce, with Storyblok as the CMS. Keep the
BigCommerce variables in `.env.local`, remove the ContentStack code, go step by step (model and load content, then connect the storefront,
visual preview, the rest). A Space ID, region, space name and Preview token were available; the Next.js quickstart and the API, tooling,
React SDK and concepts docs were linked.

**Result:** Copied the project without `node_modules`, `.next`, git history or the old `.env.local`, and created a new `.env.local` holding only the three
BigCommerce variables plus empty Storyblok ones. Mapped the coupling: ContentStack lived in `lib/contentstack.ts`, `lib/site.ts`,
`lib/blog.ts`, `lib/rte.ts`, `lib/cslp.ts`, two components, `next.config.ts` and the seed scripts, so the pages could stay almost untouched.
Proposed a five-step plan: model, load, connect, Visual Editor, cleanup.

### 2. "Updated .env.local. There is a Home page in Storyblok that we can probably overwrite. Let's go 1 and 2"
**Result:**
- Verified the Management API with the personal access token: an EU space with a quickstart `home` story and four blueprint components.
- **Model** (`scripts/seed/schemas.py`): added the `fr` language and nine content types plus six blocks. Decisions: hero banners are blocks inside pages;
  translations are field-level; enums stay English; lists of strings are one-per-line text; links to stories are uuid references.
- **Loader** (`scripts/seed/seed.py`, `sb.py`, `images.py`): 62 images and 76 published stories (6 authors, 15 FAQs, 36 posts, blog listing, 6 guides,
  6 spotlights, 2 announcements, navigation, 3 pages) in English and French, written in one pass per story; overwrote `home`; deleted the blueprint
  components.
- **Learned the hard way:** number fields must be strings on update (`422`); asset URLs are protocol-relative; a story and a folder cannot share a slug
  (so `/blog` and `/guides` became folder root stories); the raw API returns relations in `rels`; the management API needs pacing (about 3 requests/s).
  A full run takes about 5 minutes.

### 3. "Create a storyblok-skill… Also create a GitHub repo storyblok-commerce-b2b, commit and push. We can also setup Vercel…"
**Result:** Wrote the `storyblok` skill (`~/.claude/skills/storyblok/`: model, Management API, Delivery API, seeding, pitfalls, a comparison with ContentStack
and Amplience, and a secret-safe API client). Committed locally after scanning the tree for every value in `.env.local` (none found).
Creating a public GitHub repository was **blocked by the permission classifier** until the request was confirmed ("Public repo like the others, you can
create it"); then created `rezakalfane/storyblok-commerce-b2b`, pushed `main` and `staging`, and created the Vercel project with the BigCommerce and
Storyblok variables (values piped from `.env.local`, never printed). Git was connected to Vercel after step 3 so the first build could succeed.

### 4. "added STORYBLOK_PUBLIC_TOKEN"
**Result:** Checked it behaves as intended (published content readable, drafts return 401), and added it to all three Vercel scopes so Production
no longer needs the Preview token for reads.

### 5. Step 3: connect the storefront
**Result:** Replaced the ContentStack packages with `storyblok-js-client`, `@storyblok/richtext` and `@storyblok/react`. New data layer:
`lib/storyblok.ts` (clients, draft/published, signed editor check, live-edit cache, mapping helpers), `lib/blog.ts` and `lib/site.ts` mapping stories into
the shapes the pages already read, with `$` edit tags backed by block attributes. `EditSupport` renders `StoryblokLiveEditing`. Result: 13 pages return
200 in both languages, screenshots match the ContentStack UI, published HTML has no editing markup, draft requests get edit attributes, and a production
build confirmed that an unsigned or wrongly signed `?_storyblok=` returns the published page. Connected Vercel to GitHub; Production deployed and the
`staging` branch was rebuilt by the existing workflow.
- **Decision:** keep the page components and map stories, rather than register one React component per Storyblok component (it would have replaced the
  BigCommerce composition).
- **Decision:** fetch authors once per request and join by uuid, because `resolve_relations` resolves one level only.
- **Security:** drafts require the editor's signed URL (sha1 of `space:previewToken:timestamp`, under an hour old); `?_storyblok=1` alone does nothing in production.

### 6. "Can you make the Preview env public in Vercel? then let's do step 4"
**Result:** The Storyblok project had Vercel Authentication on for everything except custom domains (the other projects have none); switched it off, and the
`staging` alias returned 200. **Step 4, the Visual Editor:** preview environments (Production, Staging, Local HTTPS) and the real path of the 31 stories without a
page of their own (`scripts/seed/editor.py`); the proxy maps `/home` and `/fr/home`; `npm run dev:https`; the CSP allows localhost framing in development only.
Read the docs rather than guess: the editor requests French at an `fr/…` path prefix, and the bridge is now bundled (no CDN script).
- **Test:** an iframe from another origin on localhost showed the page hydrating, 29 tagged blocks and the bridge globals. Two earlier harnesses (an
  `about:blank` parent, and intercepting responses) gave false negatives because hydration was blocked, which is recorded in the skill.
- Click-to-edit and typing inside the real Storyblok app were left for the user to confirm (they need a Storyblok login).

### 7. "Step 5"
**Result:** This cleanup: rewrote the README and the docs for Storyblok (`storyblok.md` and `visual-editor.md` replace the ContentStack, Live Preview and
workflow pages), revised `architecture`, `implementation`, `i18n`, `operations`, `seeding` and `decisions`, regenerated the architecture diagram, removed the
ContentStack-only screenshots, and replaced this history. Storyblok app screenshots (content types, languages, Visual Editor) need a logged-in session and are not
included yet.

### French catalog content from BigCommerce
**Prompt:** BigCommerce categories and products are translated already, so get the right content for the locale (it works in the Catalyst project).

**Result:** The Storefront GraphQL API **ignores `Accept-Language`**; the Catalyst client selects the language with an `@shopperPreferences(locale: "fr")` directive on the operation (short code `fr`; `fr-FR` is not accepted). `gql()` now adds it for non-default locales, so product names and descriptions, categories, custom-field labels and facet values come back translated (151 products, 19 categories and 1,231 custom fields have French in BigCommerce). BigCommerce also translates URL paths and a product path only resolves in its own language, so the shared English slugs (D9) are kept by restoring each `path` from the default-locale catalog by entity id, resolving a product page through its English path and then reading the translated content by id. PDP key specs match on the English field name (`key`), the mega menu matches tiles by path, and cart links use the restored path. Verified on 23 French pages (no translated-path links), filters, the cart flow and English pages unchanged. Ported identically to the ContentStack and Amplience storefronts.

### Translated catalog URLs and a language switcher that finds the matching page
**Prompt:** Explore translated URLs for categories and products, working also when switching language on a category listing or product page.

**Result:** BigCommerce translates catalog paths (`/produits/batteries-automobiles/...`), only resolves a path in its own language, and returns every language's path through `locales` on products and categories. Replaced the earlier "restore English paths" approach with the real translated URLs: the catalog routes moved to `app/[locale]/[root]/...` (`CATALOG_ROOT` per language), `ensureCatalogRoot()` redirects another language's root permanently (old `/fr/products/...` links), hreflang and canonical come from `locales`, `/api/switch-locale` redirects a catalog page to its counterpart in the other language (keeping search and sort, dropping translated attribute filters), `localePath()` maps the bare `/products` link to the language's root, and the tiles and mega menu use translated paths with photos matched by category id. Verified in a headless browser on product, category, filtered listing and non-catalog pages, and the French home rich-text link was corrected in Storyblok.

### French Visual Editor opened the English Home page
**Prompt (with screenshots):** switching language to French on Home in the Storyblok editor leaves the preview in English; it works for Buying guides.

**Result:** The preview URL for Home was `.../` while a guide's was `.../fr/guides/...`: the **real path** `/` set in step 4 is used as-is by Storyblok and drops the language prefix (the same applied to the FAQ, spotlight, author and settings stories). Real paths were removed from all 31 stories (`editor.py` now clears them), and `proxy.ts` maps the editor's slug-based URLs for stories without a page (`/home`, `/fr/home`, `/faqs/...`, `/authors/...`, `/spotlights/...`, `/settings/...`) to the pages that show them, only when the editor's `_storyblok` parameter is present. Verified locally in both languages for each story type, and that public URLs are not rewritten.

### Storyblok screenshots for the documentation
**Prompt (with nine screenshots):** screenshots for the docs; did we replace all the ContentStack screenshots?

**Result:** Added the Storyblok editor screenshots (block library, the `buying_guide` component, Content, the Buying guides folder, Assets, and the Visual Editor on Home, a guide in English, a guide step and a guide in French) to `storyblok.md`, `visual-editor.md`, `i18n.md` and the README. The browser address bar is masked in each (it showed the space and story ids). Audit of the earlier cleanup: the ContentStack-specific images (`cs-*`) and the Vercel ones were already removed, but the English storefront screenshots were captured from the ContentStack site (same UI), and two French ones were stale after the BigCommerce translation work: `i18n-en-fr.jpg` (English product name and `/fr/products/` on the French side) and `home-fr.jpg`. Both were retaken from the live Storyblok site, the first now showing the translated name, breadcrumbs and `/fr/produits/` URL.

### Cart subtotal updated several times
**Prompt:** When adding to cart, the subtotal is updated multiple times (found while building the Contentful version, then ported here).

**Result:** One click on "+" in the cart showed the optimistic total, then the previous server total, then the new one (e.g. £396.80, £198.40, £396.80): when the save ended, the subtotal fell back to the server value in the props, which is still the old one until the refresh lands. `cart-view.tsx` now keeps the optimistic total until fresh server data has arrived (a `synced` flag reset on every change and set again when the props update with nothing pending). Verified in the Contentful project with a headless browser (one click: one update; three quick clicks: a steady climb); the identical file was copied here (it was byte-identical to the old version; `tsc` and `eslint` pass).

## 7 October (block model)

### Block-composed pages for every CMS
**Prompt:** (while building the switchable project `content-commerce-b2b`) Re-ordering components works great for Pages and Blog in Amplience; can we have the same for the other CMSs?

**Result:** Pages and posts become ordered lists of blocks in every CMS, so editors can reorder, add and remove components without a developer. In Storyblok the blocks are **inline**: new components `text_block`, `image_block`, `video_block` and one generic `collection_block` (`kind`: categories, spotlights, guides, posts, postListing, guideListing, faqs; `items` a multi-story relation), new fields `hero_banner.second_image` / `variant`, `page.components`, `blog_post.content` and `read_time`. They were added **next to** the earlier fixed-layout fields, and the new pages live in a `pages/` folder (`pages/home|faq|guides|blog`) because a story and a folder cannot share a slug (`/blog` and `/guides` were folder start pages).

### Port into this repository (single-CMS build)
**Prompt:** let's update storyblok-commerce-b2b first

**Result:** The UI, the content model (`core/`), the proxy and the Storyblok provider come from `content-commerce-b2b` (the private switchable project), reduced to Storyblok only: no switcher, no other CMS, no time travel. The data layer is now `providers/cms/storyblok/{client,mapper,index,actions,live-editing,edit-support}` behind the facade `lib/content.ts`; the pages are the catch-all `app/[locale]/[...slug]` and the block renderer (`components/page-content.tsx`, `page-blocks.tsx`); the catalog moved to a static `products` route with the translated roots rewritten by `proxy.ts` (`x-catalog-root`). `proxy.ts` verifies the editor's signed `_storyblok_tk` parameters and passes a trusted `x-preview` header, serves the editor's story slugs (`/pages/<key>`, `/faqs/..`, `/authors/..`, `/spotlights/..`, `/settings/..`) for editor requests only, and sets `frame-ancestors` for Storyblok. The packages `@storyblok/react` and `storyblok-js-client` are replaced by `@storyblok/js` and plain `fetch`; the seeding scripts moved from `scripts/seed` to `tools/storyblok` (new: `blocks.py`, `backup.py`; `seed.py` creates the final model directly). Parity with the Amplience provider on 9 page and language combinations (home, FAQ, guides, blog, a post and a guide, English and French): the text is identical and the pixel difference is 0.0%; the site passes the 26 URL checks (`urltest.py`).

### What the new data layer taught us
**Result:** Three findings. (1) The single-story endpoint (`cdn/stories/<slug>`) answers **422** when `per_page` is sent, so it is added to list requests only. (2) With `resolve_relations`, relation fields keep their **uuids** and the related stories come back in a separate `rels` list; the mapper looks them up (and accepts the resolved stories the bridge sends). (3) `registerStoryblokBridge` registers only for the story whose id is the `_storyblok` URL parameter, so the story open in the editor is the one that is edited live; it sends the **whole unsaved story** on every change, which the server action `liveEditUpdate` keeps for five minutes and applies (with the `__i18n__` language) before `refresh()`. Typing, reordering and adding blocks therefore re-render the page; a simulated editor swapped the hero and the intro in about 0.5 s and showed a typed title in about 0.3 s (the real editor was not tested in this repository).

### Backup and prune prepared, not run
**Result:** The earlier fixed-layout fields (`page.hero`, `page.image`, `page.intro`, `page.blocks`, `blog_post.body`, `hero_banner.full_width`), the `blog_listing_page` component and the stories `home`, `faq`, the `guides/` start page and the `blog/` start page are still in the space; the site no longer reads them. `tools/storyblok/backup.py` and `schemas.py --prune` (plus a reseed of posts and pages, then the deletion of the old stories) are prepared; **the prune has not been run and awaits approval**. The Storyblok screenshots in `docs/images/sb-*` predate the block model and are listed under "Screenshots to refresh" in `docs/visual-editor.md`.

### The prune was run
**Prompt:** run the prune.

**Result:** `backup.py` saved 19 components and 87 stories to `.backups/` (gitignored); `seed.py --only posts,pages` rewrote the posts and the `pages/` stories in the final model (the posts lose `body`); `schemas.py --prune` removed the old fields from the `page`, `blog_post` and `hero_banner` components, deleted the `blog_listing_page` component with its start page, and deleted the superseded `home`, `faq` and `guides/` stories (a new step in the script: a component prune does not touch stories of a type that stays). The space has 18 components; production and staging pass the 26 URL checks (also the switchable project reading the same space).
