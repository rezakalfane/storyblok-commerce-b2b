# Visual Editor

Editors work on the real site inside Storyblok's Visual Editor: click a block on the page to select it in the sidebar, change a
field, and see the page update as they type.

## How it fits together

```
Storyblok app ── iframe ──► storefront page  ?_storyblok=<story id>&_storyblok_lang=…&_storyblok_tk[…]=…
        ▲                          │ bridge (loaded only in the editor)
        └── input / change events ◄┘
```

1. The editor opens `<preview environment URL><story path>` in an iframe (`/pages/home`, `/fr/pages/faq`, `/blog/<slug>`…), adding `_storyblok`
   (the story id), `_storyblok_c`, `_storyblok_lang` and a signed `_storyblok_tk[space_id|timestamp|token]`.
2. `proxy.ts` verifies the signature (`providers/cms/gates.ts`) and passes the trusted request header `x-preview: 1` to the app (it removes any
   `x-preview` the client sent). The Storyblok provider then reads the **draft** with the Preview token, and the mapped content carries `$` edit
   attributes (`data-blok-c`, `data-blok-uid`) on blocks and stories.
3. `components/edit-support.tsx` renders `providers/cms/storyblok/edit-support.tsx` (the client component in `live-editing.tsx`), only for
   requests with `x-preview`. It loads the bridge (`loadStoryblokBridge` from `@storyblok/js`) **only when the page runs inside the editor
   iframe**, and registers (`registerStoryblokBridge`) for the story whose id is the `_storyblok` URL parameter.
4. On **every change** (typing, reordering blocks, adding or removing a block) the bridge sends the **whole unsaved story**. The client passes it to the
   server action `liveEditUpdate` (`actions.ts`), which verifies the signed URL parameters with the same gate, keeps the story in server memory for
   5 minutes, and calls `refresh()` (Next.js), so the open page is re-rendered **in the same response**. The next draft read of that story returns
   the unsaved version instead of the saved one.
5. On **Save** or **Publish** the bridge reloads the page.

The bridge's `resolveRelations` option is `collection_block.items`, `blog_post.author`, `buying_guide.author` and `buying_guide.related_faqs`, so
collections and authors arrive resolved in the unsaved story (the mapper accepts both uuids and resolved stories).

## How draft mode is switched on

`previewGate()` in `providers/cms/gates.ts`, run by `proxy.ts`, accepts a request only when it carries `_storyblok` **and** a valid signature:
`sha1("<space id>:<preview token>:<timestamp>")` equal to `_storyblok_tk[token]` (constant-time comparison), the space id matching
`STORYBLOK_SPACE_ID`, and the timestamp less than an hour old. In development the signature is not required, so `?_storyblok=1` is enough locally.
`liveEditUpdate` re-checks the same gate with the page's query string.

Without that check, anyone could add `?_storyblok=1` to a URL and read unpublished content. On the live site a bare `?_storyblok=`,
a wrong signature and a missing signature all return the published page with no editing markup.

## Edit attributes

Storyblok selects **blocks**, not individual fields, so `editTags()` (`providers/cms/storyblok/client.ts`) returns the same attributes for every
field of a block (`tag(block, "title")`, `tag(post, "blocks")`, …). Components spread them with the `tag(entity, field)` helper from `core/edit.ts`.
The attributes come from the block's `_editable` comment (the Delivery API adds it to draft reads), or are built from the story id and block
`_uid` when an unsaved story arrives without it. In published HTML they are empty.

## Languages

The editor requests a language as a **path prefix** of the story path: `fr/pages/home`, `fr/blog/<slug>`. The storefront already serves
`/fr/...`, and `proxy.ts` maps the editor's story slugs to pages (below). In an unsaved story, the bridge's story carries all languages as
`field__i18n__fr`; `applyLanguage()` (`client.ts`) copies the active language over the base field before rendering, so French edits show
immediately.

## Editor URLs

Set by `python3 tools/storyblok/editor.py` (Settings → Visual Editor; it adds the environments to the space and keeps the other ones):

| Environment | URL |
|---|---|
| Production (default) | `https://storyblok-commerce-b2b.vercel.app/` |
| Staging | `https://storyblok-commerce-b2b-git-staging-rza-kalfanes-projects.vercel.app/` |
| Local (npm run dev:https) | `https://localhost:3000/` (run `npm run dev:https` and accept the certificate once; the editor requires HTTPS) |

**No real paths.** Do not set a "real path" on stories: Storyblok uses it as-is and **drops the language prefix**, so a French edit of Home
(real path `/`) opened the English page. Without one the editor opens `<URL><slug>` and `<URL>fr/<slug>`. Stories with no page of their own
are mapped by `proxy.ts`, **only for editor requests** (`_storyblok` in the query), in both languages: `pages/<key>` to the page with that key
(`pages/home` to `/`, `pages/faq` to `/faq`, `pages/guides` to `/guides`, `pages/blog` to `/blog`), `faqs/<slug>` to `/faq`, `authors/<slug>` to
`/blog`, and `spotlights/<slug>` and `settings/<slug>` to `/`. Blog posts and guides need nothing (`/blog/<slug>`, `/guides/<slug>`).

The CSP `frame-ancestors` header is set per request by `proxy.ts` and allows only `https://app.storyblok.com` and `https://*.storyblok.com` (and
`localhost` in development).

## Using it

1. In Storyblok open **Content**, pick a story (for example `pages/home` or a buying guide).
2. The Visual Editor shows the page. Click a block to select it, edit fields in the sidebar, switch language with the language menu.
3. To reorder the page, drag the blocks in the story's **components** list; add a block with the plus button.
4. Typing, reordering and adding blocks update the page as you go; **Save** keeps the draft, **Publish** makes it live.

![Visual Editor on the Home story](images/sb-visual-editor-home.jpg)
*Home (a screenshot of the earlier fixed-layout Home story): the hero banner block is selected on the page and its fields (title, description, image, call to action) are in the sidebar.*

![Visual Editor on a buying guide, English](images/sb-visual-editor-guide-en.jpg)
*A buying guide in English: clicking the title selects the story; the sidebar shows its fields. (Buying guides are unchanged by the block model.)*

![Selecting a guide step in the Visual Editor](images/sb-visual-editor-guide-step.jpg)
*Clicking a numbered step on the page selects that `guide_step` block (title, body, pro tip) inside the story.*

![Visual Editor on a buying guide, French](images/sb-visual-editor-guide-fr.jpg)
*The same guide with the language menu on French: the preview loads `/fr/guides/…`, and each translatable field shows its French value under the default-language text.*

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Blank frame, "refused to connect" | the CSP does not allow the editor, or the environment URL is wrong | check the `Content-Security-Policy` header and the environment URL |
| Page loads but nothing is clickable | draft mode not on (bad or old signature), or the preview token differs from the deployment's | open the page from the editor again; check `STORYBLOK_PREVIEW_TOKEN` on that deployment |
| Editor opens a 404 (`/faqs/…`, `/pages/…`) | the story's folder is not mapped in the editor rewrite of `proxy.ts` | add the folder there; do not use a real path |
| French editor shows the English page | the story has a **real path** (it removes the `fr/` prefix) | clear the real path in the story's settings |
| Typing does not update the page | the bridge is not registered | the bridge registers only for the story whose id is the `_storyblok` URL parameter, and the page must be inside the iframe; a different story (for example a guide shown inside a collection) is edited by opening it |
| French edits show English text while typing | the unsaved story was not localized | see `applyLanguage()` in `providers/cms/storyblok/client.ts` |
| Local editing fails | not on HTTPS | `npm run dev:https` and accept the certificate |
| Live edits only sometimes appear on Vercel | the unsaved story is kept in the memory of one server instance | can be intermittent on serverless; Save reloads the page, and local development is reliable |
| The server action returns false | the signed URL parameters are older than an hour or do not match the Preview token | open the page from the editor again |

The bridge is bundled in the page (the SDK imports it dynamically), so there is no script to look for in the network tab: in the
browser console, `window.StoryblokBridge` and `window.storyblokRegisterEvent` exist once it has loaded.

## Screenshots to refresh

These images in `docs/images/` predate the block model (they show the fixed-layout Home with a single hero field, the earlier folder layout, or the
component list before the block components) and are kept with a note until they are retaken: `sb-visual-editor-home.jpg`, `sb-block-library.jpg`,
`sb-content.jpg` and `sb-content-guides.jpg`. The others (`sb-visual-editor-guide-en.jpg`, `sb-visual-editor-guide-fr.jpg`,
`sb-visual-editor-guide-step.jpg`, `sb-content-type-buying-guide.jpg`, `sb-assets.jpg`) show screens the block model did not change.
