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
