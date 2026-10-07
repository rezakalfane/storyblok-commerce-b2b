# Storyblok

## The space

| Setting | Value |
|---|---|
| Space | "Commerce B2B" (EU region) |
| Hosts (EU) | Management API `https://mapi.storyblok.com/v1`, Content Delivery API `https://api.storyblok.com/v2/cdn` (other regions: `api-us.`, `api-ca.`, `api-ap.`) |
| Languages | English (the default language, addressed as `default`) and French (`fr`), translated **per field** |
| Environments | None: a story has a draft and a published version; the **access token** chosen at read time decides which one you see |
| Visual Editor | Preview environments Production, Staging and Local ([visual-editor.md](visual-editor.md)) |

The region comes from `STORYBLOK_REGION` (`eu`, `us`, `ca`, `ap`, `cn`). A space created in one region is not reachable through another
region's host.

## Access tokens

| Token | Used by | Sees |
|---|---|---|
| **Public** (`STORYBLOK_PUBLIC_TOKEN`) | the live site | published content only (asking for drafts returns 401) |
| **Preview** (`STORYBLOK_PREVIEW_TOKEN`) | the Visual Editor and local development | drafts and published; kept server-side |
| **Personal access token** (`STORYBLOK_OAUTH_TOKEN`) | the seeding scripts (Management API) | read and write the whole space; **never** needed to run the site, never sent to a host or the browser |

Public, Preview, Asset and Theme tokens are created in the app (Settings → Access Tokens); the personal access token under
My Account → Account Settings. The storefront reads published content with the Public token and uses the Preview token only
when a request comes from the Visual Editor with a valid signature ([visual-editor.md](visual-editor.md#how-draft-mode-is-switched-on)).
If `STORYBLOK_PUBLIC_TOKEN` is missing, the Preview token is used with `version=published`, so nothing leaks, but the Public token is the intended one.

## Content model

Pages and articles are **ordered lists of inline blocks**: an editor stacks, reorders and removes blocks in the story, and the site renders
them top to bottom. The model has content types (components with *Content type* enabled) for the stories, and nestable components for the
blocks. All are defined in `tools/storyblok/schemas.py`.

> **State of the space.** The block model was added **next to** the earlier fixed-layout model, which is still in the space (the site no longer
> reads it). Fields and stories that belong only to the old model are listed under [Old model, pending prune](#old-model-pending-prune); the
> prune is prepared (`schemas.py --prune`) and has not been run.

![The Block library in Storyblok](images/sb-block-library.jpg)
*Block library (a screenshot from before the block components were added): the content types (`Content Type`) and the nestable blocks (`Nestable`).*

### Content types

| Component | Purpose | Key fields |
|---|---|---|
| `page` | A page made of blocks: `pages/home`, `pages/faq`, `pages/guides`, `pages/blog`, or any page an editor adds | `title`, `description`, **`components`** (bloks, in order: `hero_banner`, `feature_block`, `text_block`, `image_block`, `video_block`, `collection_block`), `seo_title`, `seo_description` |
| `blog_post` | An article | `title`, `author` (reference), `date`, `featured_image`, **`content`** (bloks: `text_block`, `image_block`, `video_block`), `read_time`, `related_post` (reference), `is_archived`, SEO, `seo_keywords` |
| `author` | Article / guide author | `name`, `picture`, `bio` |
| `faq` | A question and rich-text answer | `question`, `answer`, `topic` (option), `sort_order`, `is_featured` |
| `buying_guide` | Step-by-step guide | `title`, `summary`, `hero_image`, `audience` (option), `read_minutes`, `steps` (`guide_step`s), `checklist` (one per line), `recommended_bc_products` and `recommended_skus` (comma-separated), `related_faqs` (references), `author` |
| `product_spotlight` | Editorial layer over a BigCommerce product | `title`, **`bc_product_id`**, `bc_sku`, `tagline`, `editorial_summary`, `key_features` (one per line), `use_cases` (`use_case`s), `badge` (option), `editorial_image`, `is_featured` |
| `announcement_bar` | Scheduled site-wide banner | `title` (internal), `message`, `cta_label`, `cta_href`, `style`, `audience`, `starts_at`, `ends_at`, `is_active` |
| `site_navigation` | Header, footer and contact details | `header_links` (`nav_link`s), `footer_columns` (`footer_column`s), `sales_email`, `support_phone`, `opening_hours`, `legal_text` |

![Editing the buying_guide component](images/sb-content-type-buying-guide.jpg)
*The `buying_guide` content type in the component editor: text, textarea, asset, single-option, number and blocks fields.*

### Blocks (nestable components)

| Component | Renders as | Fields |
|---|---|---|
| `hero_banner` | the hero (the `home` variant shows the staggered photo pair) | `title`, `description`, `image`, `second_image`, `cta_label`, `cta_href`, `variant` (`default` / `home`) |
| `feature_block` | a feature row (consecutive ones share a band) | `title`, rich-text `copy`, `image`, `layout` (`image_left` / `image_right`) |
| `text_block` | rich text | `text` |
| `image_block` | a full-width image | `image`, `alt` |
| `video_block` | a video player | `video_title`, `src` (file URL) |
| `collection_block` | a list-like section, chosen by `kind` | `kind`, `title`, `link_label`, `search_placeholder`, `search_button_label`, `items` |

`collection_block.kind` is one of `categories` (the category mosaic, from BigCommerce), `spotlights`, `guides`, `posts`, `postListing` (search box and
all articles), `guideListing` (all guides) and `faqs`. `items` is a multi-story relation (guides, spotlights, posts or FAQs; only the type the
kind expects is shown). The remaining small blocks are `guide_step`, `use_case`, `nav_link` and `footer_column`.

Blocks are **inline**: they live inside the page or post story, not as separate entries, so ordering is native and the Visual Editor edits a
block in place.

### Folders and URLs

| Folder | Holds | URL |
|---|---|---|
| `pages/` | the `page` stories `home`, `faq`, `guides`, `blog` | `/`, `/faq`, `/guides`, `/blog` (page key -> story `pages/<key>`) |
| `blog/` | `blog_post` stories | `/blog/<slug>` |
| `guides/` | `buying_guide` stories | `/guides/<slug>` |
| `authors/`, `faqs/`, `spotlights/` | stories shown inside other pages | no page of their own |
| `settings/` | `navigation` and the announcement bars | no page of their own |

![The Content browser at the root of the space](images/sb-content.jpg)
*Content: the root of the space (a screenshot from before the `pages/` folder was added), with the folders `blog`, `guides`, `authors`, `faqs`, `spotlights` and `settings`.*

![The Buying guides folder](images/sb-content-guides.jpg)
*Inside `guides/`: the folder root story (an older fixed-layout Page, no longer used) and the six buying guides.*

The editor opens a story at its slug (`/pages/home`, `/fr/pages/faq`, `/faqs/<slug>`...); `proxy.ts` serves those URLs for editor requests only
([visual-editor.md](visual-editor.md#editor-urls)).

### Old model, pending prune

Still in the space and no longer read by the site: the fields `page.hero`, `page.image`, `page.intro`, `page.blocks`, `blog_post.body` and
`hero_banner.full_width`; the `blog_listing_page` component; and the stories `home`, `faq`, the `guides/` start page and the `blog/` start page.
`tools/storyblok/schemas.py --prune` removes them (after `tools/storyblok/backup.py`, and a reseed of posts and pages so the stories lose the old
values). It is prepared and has not been run ([seeding.md](seeding.md#backup-and-prune)).

### Field conventions

- **Translatable fields** store the French text next to the default: `title` and `title__i18n__fr`. Blocks inside a story translate the same way.
- **Enums** (`topic`, `audience`, `badge`, `style`, `kind`, `variant`) store fixed English values; the storefront maps the visible ones to French labels
  (`topicLabel`, `audienceLabel`, `badgeLabel` in `lib/i18n.ts`). Add a choice in both places.
- **Lists of strings** are one-per-line text areas (`checklist`, `key_features`) or comma-separated text (`recommended_bc_products`).
- **Numbers are strings** in the story JSON (`"377"`); **dates** are `YYYY-MM-DD HH:mm` (UTC).
- **Buttons** are `cta_label` + `cta_href` (a storefront path such as `/guides`); the app adds the `/fr` prefix.
- **Links between stories** (author, related FAQs, related posts, collection items) are `option` / `options` fields that store the target's **uuid**.

## Content volume (sample)

| Type | Stories |
|---|---|
| `author` | 6 |
| `blog_post` | 36 (each with a text block in `content`) |
| `page` | 4 in `pages/` (`home`, `faq`, `guides`, `blog`: 8, 2, 2 and 3 blocks) |
| `faq` | 15 |
| `buying_guide` | 6 |
| `product_spotlight` | 6 |
| `announcement_bar` | 2 |
| `site_navigation` | 1 |

(Until the prune runs, the space also holds the old `home`, `faq`, `guides/` and `blog/` start-page stories, including the one `blog_listing_page`.)

Plus 62 images in Assets. All content is fictional sample text, in English and French.

![Assets in Storyblok](images/sb-assets.jpg)
*Assets: the 62 images uploaded by the seeding script (hero photos, home blocks, spotlight cards, guide photos).*

## Reading content

All reads go through `providers/cms/storyblok/client.ts` (`getStory`, `getStories`) and are mapped to the content model (`core/content.ts`) by
`providers/cms/storyblok/mapper.ts` ([implementation.md](implementation.md#1-data-layer)). The pages call the facade `lib/content.ts`.

```
GET https://api.storyblok.com/v2/cdn/stories/pages/home?version=published&language=fr&resolve_relations=collection_block.items&token=<public token>
GET https://api.storyblok.com/v2/cdn/stories?starts_with=faqs/&content_type=faq&per_page=100&version=published&token=<public token>
```

- `language=default|fr` selects the translation; untranslated fields return the default value.
- `resolve_relations` (`component.field` paths) makes the API return the referenced stories in a separate `rels` array while the relation fields keep the
  **uuids**; the mapper looks them up (`rel()` in `client.ts`). The relations read are `collection_block.items`, `blog_post.author`,
  `buying_guide.author` and `buying_guide.related_faqs`.
- `per_page` is valid on lists only: sending it to a single-story request (`cdn/stories/<slug>`) returns **422**.
- Lists return at most 100 stories per page.
- Published reads are cached by Next.js for 60 seconds; draft reads are never cached.

## Publishing

Saving a story creates or updates its **draft**; **Publish** makes the draft the published version for **all languages at once**
(field-level translation keeps both in one story). The live site shows published content within about a minute. There is no
per-environment or per-language publish step, and no approval gate: use the Visual Editor's draft preview, or the staging
deployment, to review before publishing ([operations.md](operations.md)).

## Plan and limits

- The space is on Storyblok's trial plan (Joyride), which expires around 21 November 2026; confirm a plan for continued use.
- The Management API allows about 3 requests per second; the seeding scripts pace themselves and retry on `429`.
