# Live Preview and Visual Editor

Goal: when an editor changes a field in the Contentstack entry form, the storefront preview updates without saving, and
elements on the page can be clicked to jump to the matching field (inline editing).

## How it works

```
Contentstack app ── entry form edits ──► draft stored under a "live preview hash"
        │
        └─ iframe: http://localhost:3000/<page>?live_preview=<hash>&content_type_uid=…&entry_uid=…&locale=…
                              │
        Next.js (server) ◄────┘   getStack(preview): preview token + host eu-rest-preview.contentstack.com
                                  + stack.livePreviewQuery(params)  → entries read from the DRAFT
```

- **SSR mode** (`ssr: true`): after each edit the preview pane asks the site for fresh HTML; our Server Components read
  the draft through the preview host and render it. No client-side data fetching is needed.
- The **hash** in the URL identifies the draft session. `lib/contentstack.ts → previewParams()` extracts it and
  `getStack(preview)` applies it with `livePreviewQuery()`.
- **Edit tags** (`data-cslp` attributes) mark which field each element shows. In **Visual Editor**, clicking an element
  opens its field; hovering shows an outline and a label (for example "Hero Banner : Banner Title").

![Visual Editor, English home page](images/cs-visual-editor-en.jpg)
*Visual Experience on the English home page: hovering shows the field ("Hero Banner : Banner Description"), clicking edits it inline, and the form on the right stays in sync.*

## One-time setup in Contentstack

1. **Settings → Live Preview**: enable it, choose the **`preview`** environment, and add the **preview token**.
2. Set the **Base URL for each locale** (this is the "base URL" needed for French):

   | Locale | Base URL (`local` environment) |
   |---|---|
   | English (en-us) | `http://localhost:3000` |
   | French (fr-fr) | `http://localhost:3000/fr` |

   In production use your real domain: `https://www.example.com` and `https://www.example.com/fr`.
3. Enable **Visual Experience / Visual Editor** for the stack and use the same base URLs.
4. For each content type with a URL (blog, guides) and for `page`, Live Preview resolves the entry from the page URL;
   our pages also declare their entry explicitly (see below).

![Environments and base URLs](images/cs-environments.jpg)
*Settings → Environments lists each environment's Live Preview base URL per locale: `production` → the live site, `preview` → the staging site, `local` → localhost. Pick the environment in Visual Editor to edit against it ([workflow.md](workflow.md)).*

## Application setup

| Piece | File | What it does |
|---|---|---|
| Preview stack | `lib/contentstack.ts` | `getStack(preview)`, `previewParams()`; preview host from `CONTENTSTACK_REGION` |
| SDK init | `components/live-preview.tsx` | `ContentstackLivePreview.init({ ssr: true, mode: "builder", … })` once per page load |
| Entry context | `components/edit-support.tsx` | `<meta name="contentstack:entry-uid">` and `<meta name="contentstack:content-type-uid">` |
| Edit tags | `lib/contentstack.ts → tagEntry()` | `addEditableTags(entry, contentType, true, locale)` adds `entry.$.<field>` |
| Embedding | `next.config.ts` | `Content-Security-Policy: frame-ancestors` for `*.contentstack.com` / `.io` |

### Init options used

```ts
ContentstackLivePreview.init({
  ssr: true,                       // SSR: the page is re-requested after each edit
  enable: true,
  mode: "builder",                 // "Start Editing" opens Visual Editor
  stackDetails: { apiKey, environment },
  clientUrlParams: { protocol: "https", host: "eu-app.contentstack.com", port: 443 },
  editButton: { enable: true, position: "top-right" },
  editInVisualBuilderButton: { enable: true, position: "bottom-right" },
  overlayPropagation: { enable: true },   // our hero photos sit under a gradient overlay
});
```

### Why `<meta>` tags instead of `setPageContext`

`setPageContext()` posts a message to the Visual Builder and waits for an acknowledgement. When there is no builder
frame (for example in **Timeline mode**) the SDK logs *"Failed to send page context … The ACK was not received"*, which
Next.js shows as an error overlay. The SDK documents `<meta>` tags as an equivalent source of the page context and they
send no message, so they are used instead.

### Edit tags

Tags are added **only in preview** (and the SDK itself is loaded only in preview or local development,
`EDIT_MODE`). Elements opt in by spreading the tag object, which is `{}` when there is none:

```tsx
<h1 {...(hero.$?.title ?? {})}>{hero.title}</h1>
```

Fields tagged today:

| Page | Tagged fields |
|---|---|
| Home / hero banners | title, description, call to action, banner image, second photo (`page.image`), rich text, each block's title / copy / image (and the blocks list) |
| Blog | post title, date, featured image, body, author name and bio; section titles on the listing; card titles and images |
| Guides | title, summary, hero image, each step's title / body / pro tip (and the steps list), each checklist item (and the checklist); card titles and summaries |
| FAQ | question and answer |
| Spotlights | title and tagline |
| Site chrome | announcement message, header link labels, footer legal line |

![Click-to-edit on a guide step](images/cs-visual-editor-guide-step.jpg)
*A French buying guide in Visual Editor: "Buying Guide : Step body" is outlined on hover, and the numbered steps, checklist and recommended products are real fields.*

Repeatable fields need two kinds of tag (found when the guide checklist could not be edited visually):

| Tag | Spread on | Effect |
|---|---|---|
| `entry.$.<field>__<index>` (for example `checklist__0`) | each item element | click-to-edit that single item |
| `entry.$.<field>__parent` (for example `checklist__parent`, `steps__parent`, `blocks__parent`) | the list container | lets the editor add, remove and reorder items |

Groups and modular blocks tag their sub-fields on the item itself (`step.$?.step_title`), as the steps do.

BigCommerce data (names, prices, images) is **not** editable here: it is edited in BigCommerce.

## Per-locale preview

Each locale has its own base URL, so editing the French entry opens `/fr/...` and reads `fr-fr` content. The locale comes
from the route (`/fr`), not from the query string.

![Visual Editor, French home page](images/cs-visual-editor-fr.jpg)
*The French locale (`fr-fr`) in Visual Editor: the page at `/fr` loads, the language switcher shows FR, and the rich-text field is outlined ("Page : Rich Text").*

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Preview shows published content, not edits | Preview token missing or wrong; `live_preview` param not reaching the page; base URL for that locale not set |
| 404 in the preview pane | The route does not exist for that URL, or the entry's `url` differs from the page path |
| `Encountered two children with the same key` | The preview API returned an entry twice; handled by `uniqueByUid` (add it to any new list fetcher) |
| `Failed to send page context … ACK` | Calling `setPageContext` outside Visual Builder; use meta tags (already done) |
| Clicking an element does nothing | The element has no edit tag, the field is not tagged, or an overlay covers it (`overlayPropagation` is on) |
| "Refused to display … in a frame" | CSP / `X-Frame-Options`; the allowed ancestors are set in `next.config.ts` (restart the dev server after changing it) |
| Edits are slow | In SSR mode every edit triggers a full server render; keep fetchers parallel (`Promise.all`) |

## Adding editing support to a new page or field

1. Fetch through `entriesOf(...)` / a helper that calls `tagEntry(...)`.
2. Spread `entry.$?.<field>` on the element that displays it (use the field UID; for repeated groups use the item's own `$`).
3. Render `<EditSupport preview={preview} entry={{ uid, contentType }} />` in the page.
4. Add the field to the table above.
