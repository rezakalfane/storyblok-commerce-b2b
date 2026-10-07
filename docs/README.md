# Documentation

| Document | Read it when you want to… |
|---|---|
| [architecture.md](architecture.md) | understand how Storyblok, BigCommerce and Next.js fit together, and how a request is served |
| [implementation.md](implementation.md) | see how each feature works (listing, filters, product page, cart, hero, guides…) and where the code lives |
| [storyblok.md](storyblok.md) | work with the space: tokens, the content model, folders and URLs, reading and publishing |
| [visual-editor.md](visual-editor.md) | set up and debug the Visual Editor: signed preview URLs, the bridge and live edits, editor URLs, languages, preview environments |
| [bigcommerce.md](bigcommerce.md) | work with the catalog: channel, token, the GraphQL queries, facets, categories, cart |
| [i18n.md](i18n.md) | add a language or translate content: URL strategy, fallback, dictionaries, hreflang |
| [seeding.md](seeding.md) | model the space and create or refresh sample content with the Python scripts; backup and the pending prune |
| [design-system.md](design-system.md) | build UI in the "Workbench" look: tokens, type, components, imagery |
| [operations.md](operations.md) | set up environment variables, run, deploy and troubleshoot |
| [decisions.md](decisions.md) | learn why choices were made, and what was rejected |

Also see the top-level [README](../README.md) and [HISTORY](../HISTORY.md) (every request and its outcome).

## Vocabulary

- **Story**: one piece of Storyblok content (an article, an FAQ, a page). **Component**: a schema; a **content type** is a component a story
  is built from, a **block** (nestable component) lives inside a story.
- **Language**: a translation of a story. Storyblok codes are `default` (English) and `fr`; URL prefixes are `en` (hidden) and `fr`.
  Translations are **field-level**: `title` and `title__i18n__fr` in the same story.
- **Block**: a nestable component inside a story, in an ordered list (`page.components`, `blog_post.content`). A **collection block** shows a list (guides, FAQs…).
- **Page key**: the slug of a story in `pages/` (`home`, `faq`, `guides`, `blog`), which is also its URL.
- **Folder root story**: the story that represents a folder, served at the folder's URL. The earlier `guides/` and `blog/` root stories are superseded by the `pages/` stories.
- **CDA / MAPI**: Storyblok's Content *Delivery* API (read) and *Management* API (write).
- **Draft / published**: the two versions of a story. The **Public** token reads published; the **Preview** token reads both.
- **Visual Editor**: Storyblok's in-page editor. The **bridge** is the script that connects the page to it; **edit attributes**
  are the `data-blok-*` attributes that make blocks clickable.
- **Staging**: the Vercel site built from the `staging` branch ([operations.md](operations.md)).
- **PLP / PDP**: product listing page / product detail page.
