# Seeding sample content

The Python scripts in `tools/storyblok/` create and refresh the whole Storyblok space through the **Management API**: the content model
(including the block components), the languages, 62 images and the published stories in English and French. They are **idempotent**: assets are looked up by file name,
stories by slug, and both are updated in place, so they are safe to re-run.

## Prerequisites

- Python 3.12+ with Pillow (`pip install pillow`).
- `.env.local` (at the repository root) containing `STORYBLOK_SPACE_ID`, `STORYBLOK_REGION` and `STORYBLOK_OAUTH_TOKEN` (a personal access token),
  plus `BIGCOMMERCE_STORE_HASH`, `BIGCOMMERCE_CHANNEL_ID` and `BIGCOMMERCE_STOREFRONT_TOKEN` (the spotlights use real product photos
  downloaded from BigCommerce).

Credentials are read from `.env.local` and never printed (error output is redacted).

## Run order

```bash
python3 tools/storyblok/schemas.py      # 1. French language + components (content model)
python3 tools/storyblok/seed.py         # 2. images and stories in English and French, published; pages/* from blocks
python3 tools/storyblok/editor.py       # 3. Visual Editor: preview environments (production, staging, local)
```

`seed.py --only authors,faqs,posts,guides,spotlights,settings,pages` loads a subset. Authors and FAQs are always (re)loaded when a
later section needs their uuids (posts and guides reference them).

**A space that still has the earlier fixed-layout model** (this one, until the prune runs) is upgraded additively with
`python3 tools/storyblok/blocks.py`: it creates the `pages/` stories and gives every post a `content` text block and a `read_time`, leaving the old
fields filled.

> **Both languages are written together.** Each story is saved once with its English values and the `__i18n__fr` translations, so
> there is no separate "localize" step. The French text lives in the `*_fr.py` data files, in the same order and shape as the English data.

## What `seed.py` does, in order

1. Folders (`blog`, `guides`, `authors`, `faqs`, `spotlights`, `settings`) with a default content type each.
2. Authors (a generated avatar each) and FAQs.
3. 36 blog posts. Each gets a `content` list with one `text_block` (the article, with a stable block uid) and a `read_time`. A post's `related_post`
   points to an **earlier** post, so its uuid already exists.
4. 6 buying guides, 6 product spotlights (the editorial image is the BigCommerce product photo composed on a branded card).
5. Announcement bars and the navigation (`settings/`).
6. The pages: `blocks.build_pages()` creates the `pages` folder and the stories `home`, `faq`, `guides` and `blog`, each an ordered list of inline blocks
   (home: hero, intro text, category tiles, three features, trade favourites, guides row; faq: hero and the FAQ collection; guides: hero and the guide
   listing; blog: hero, the latest three articles and the article listing). The collections point at the stories created above by uuid.

## Files

| File | Role |
|---|---|
| `sb.py` | Management API helper: requests (paced to about 3 per second, retry on `429`, token redacted), asset upload, story upsert, folder and root-story helpers, rich-text builder |
| `schemas.py` | field builders and the component definitions; adds the `fr` language, creates or updates the components; `--prune` removes components that left the model |
| `seed.py` | loads everything (see above) |
| `blocks.py` | the page stories made of blocks and the post content blocks: `build_pages()` (called by `seed.py`) and `post_blocks()` (the additive upgrade of old posts) |
| `backup.py` | saves the components and every story (with content) to `.backups/storyblok-<timestamp>.json` (gitignored) |
| `editor.py` | adds the Visual Editor preview environments (production, staging, local) and keeps the others; sets no real paths |
| `images.py` | gradients, avatars, composed product cards, product photos from BigCommerce |
| `content.py` | English authors and the 36 posts (title, intro, two sections, takeaways) |
| `content_extra.py` | FAQs, product keys (`P`), guides, spotlights, announcements, home page, navigation |
| `content_fr.py`, `content_fr_posts.py` | French translations, in the same order and shape as the English data |
| `photos.py`, `photos/*.jpg` | the nine text-free photos and a cropper that produces varied crops |

## Backup and prune

**Prepared, not run.** The space still holds the earlier fixed-layout model next to the blocks (the site no longer reads it): the fields `page.hero`,
`page.image`, `page.intro`, `page.blocks`, `blog_post.body` and `hero_banner.full_width`; the `blog_listing_page` component; and the stories `home`,
`faq`, the `guides/` start page and the `blog/` start page. The steps to remove them, in this order:

1. `python3 tools/storyblok/backup.py` saves everything to `.backups/` first.
2. `python3 tools/storyblok/seed.py --only posts,pages` reseeds posts and pages in the final model (a story `PUT` replaces its content, so the old `body`
   leaves the posts).
3. `python3 tools/storyblok/schemas.py` (listing) and then `python3 tools/storyblok/schemas.py --prune`: the schemas lose the old fields, and the
   components that left the model are deleted **with the stories that use them** (the old blog start page).
4. Delete the remaining old stories `home`, `faq` and the `guides/` start page in the app, or with the API.

Verify the sites (`urltest.py` on production and staging) before and after.

## How the pieces work

### Assets (`sb.upload_asset`)
Storyblok uploads in three steps: `POST /assets` (returns a signed S3 form), a multipart `POST` of the file to that form, then
`GET /assets/<id>/finish_upload`. The returned URL is protocol-relative (`//a.storyblok.com/...`) and is normalised to `https:`.
An asset whose file name already exists is reused, so re-running does not duplicate images. To replace an image, delete the asset
in Storyblok (or change the file name) and re-run.

### Stories (`sb.upsert_story`)
Looks the story up with `with_slug`, then `PUT`s the **whole** content (a `PUT` replaces it) with `publish: 1`, or `POST`s a new one.
Folder root stories use `upsert_startpage`.

### Translations (`tr()` in `seed.py`)
`tr(content, "title", "English", "Français")` sets `title` and `title__i18n__fr`. Blocks inside stories (steps, nav links…) use the
same helper.

### Rich text (`sb.richtext`)
Builds Storyblok's JSON document (`paragraph`, `heading`, `bullet_list`, with `link` marks) from `("p", text)`, `("h2", text)`,
`("ul", [items])`. `html_paragraphs()` converts the simple `<p>…<a href>…</a></p>` strings used for the home page.

## Pitfalls

- Number fields must be strings (`"377"`), or an update fails with `422 … must be a string with numbers`.
- A story and a folder cannot share a slug at the same level: this is why the pages live in a `pages/` folder (`/blog` and `/guides` are page keys, not folders).
- `PUT` replaces `content`: always send every field and every `__i18n__` sibling.
- Reference fields store uuids, not ids.
- On a 429 the helper waits and retries; a full run takes about 5 minutes.

## Adding content from the app instead

Open the folder in Storyblok → **New story** (the folder preselects the content type). Fill the English fields, switch the language
menu to French and translate the translatable fields, then publish.
