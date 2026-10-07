# Seeding sample content

The Python scripts in `scripts/seed/` create and refresh the whole Storyblok space through the **Management API**: the content model,
the languages, 62 images and 76 published stories in English and French. They are **idempotent**: assets are looked up by file name,
stories by slug, and both are updated in place, so they are safe to re-run.

## Prerequisites

- Python 3.12+ with Pillow (`pip install pillow`).
- `storefront/.env.local` containing `STORYBLOK_SPACE_ID`, `STORYBLOK_REGION` and `STORYBLOK_OAUTH_TOKEN` (a personal access token),
  plus `BIGCOMMERCE_STORE_HASH`, `BIGCOMMERCE_CHANNEL_ID` and `BIGCOMMERCE_STOREFRONT_TOKEN` (the spotlights use real product photos
  downloaded from BigCommerce).

Credentials are read from `.env.local` and never printed (error output is redacted).

## Run order

```bash
cd storefront
python3 scripts/seed/schemas.py      # 1. French language + components (content model)
python3 scripts/seed/seed.py         # 2. images, 76 stories in English and French, published
python3 scripts/seed/editor.py       # 3. Visual Editor: preview environments and real paths
```

`seed.py --only authors,faqs,posts,guides,spotlights,settings,pages` loads a subset. Authors and FAQs are always (re)loaded when a
later section needs their uuids (posts and guides reference them).

> **Both languages are written together.** Each story is saved once with its English values and the `__i18n__fr` translations, so
> there is no separate "localize" step. The French text lives in the `*_fr.py` data files, in the same order and shape as the English data.

## What `seed.py` does, in order

1. Folders (`blog`, `guides`, `authors`, `faqs`, `spotlights`, `settings`) with a default content type each.
2. Authors (a generated avatar each) and FAQs.
3. 36 blog posts. A post's `related_post` points to an **earlier** post, so its uuid already exists. Then the blog listing, which is the
   `blog` folder's root story.
4. 6 buying guides, 6 product spotlights (the editorial image is the BigCommerce product photo composed on a branded card).
5. Announcement bars and the navigation (`settings/`).
6. The pages: it **overwrites the `home` story** created by Storyblok's quickstart, then creates `faq` and the `guides` root story.

## Files

| File | Role |
|---|---|
| `sb.py` | Management API helper: requests (paced to about 3 per second, retry on `429`, token redacted), asset upload, story upsert, folder and root-story helpers, rich-text builder |
| `schemas.py` | field builders and the component definitions; adds the `fr` language, creates or updates the components |
| `seed.py` | loads everything (see above) |
| `editor.py` | preview environments and the real path of each story |
| `images.py` | gradients, avatars, composed product cards, product photos from BigCommerce |
| `content.py` | English authors and the 36 posts (title, intro, two sections, takeaways) |
| `content_extra.py` | FAQs, product keys (`P`), guides, spotlights, announcements, home page, navigation |
| `content_fr.py`, `content_fr_posts.py` | French translations, in the same order and shape as the English data |
| `photos.py`, `photos/*.jpg` | the nine text-free photos and a cropper that produces varied crops |

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
- A story and a folder cannot share a slug at the same level; use a folder root story for `/blog` and `/guides`.
- `PUT` replaces `content`: always send every field and every `__i18n__` sibling.
- Reference fields store uuids, not ids.
- On a 429 the helper waits and retries; a full run takes about 5 minutes.

## Adding content from the app instead

Open the folder in Storyblok → **New story** (the folder preselects the content type). Fill the English fields, switch the language
menu to French and translate the translatable fields, then publish.
