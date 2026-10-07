# Operations

## Prerequisites

- Node.js 22+ and npm (the project is built and tested on Node 24).
- Python 3.12+ with Pillow for the seeding scripts (optional for running the site).
- A Storyblok space (Public and Preview access tokens; a personal access token for seeding) and a BigCommerce store with a
  storefront channel and a Storefront API token.

## Environment variables

Copy `.env.example` to `.env.local`. **All are server-side**; none use the `NEXT_PUBLIC_` prefix.

| Variable | Required | Meaning |
|---|---|---|
| `STORYBLOK_SPACE_ID` | yes | the space id (used to validate Visual Editor URLs and build edit attributes) |
| `STORYBLOK_REGION` | yes | `eu`, `us`, `ca`, `ap` or `cn` (`eu` today) |
| `STORYBLOK_PUBLIC_TOKEN` | yes in production | reads **published** content only |
| `STORYBLOK_PREVIEW_TOKEN` | for the Visual Editor | reads drafts; also validates the editor's signed URL |
| `STORYBLOK_OAUTH_TOKEN` | seeding only | personal access token (Management API); **never** needed to run the site |
| `BIGCOMMERCE_STORE_HASH` | yes | store hash |
| `BIGCOMMERCE_CHANNEL_ID` | yes | channel ID of the headless storefront channel |
| `BIGCOMMERCE_STOREFRONT_TOKEN` | yes | channel-scoped Storefront API token (one allowed origin) |

`.env.local` is gitignored. Do not paste token values into chats, tickets or commit messages.

## Running locally

```bash
npm install
npm run dev            # http://localhost:3000 (English), http://localhost:3000/fr (French)
npm run dev:https      # https://localhost:3000, required to edit in the Visual Editor
```

After changing `next.config.ts`, `proxy.ts` or `.env.local`, **restart the dev server**. In development any request with `?_storyblok=…`
is treated as a draft preview (no signature needed), which is handy for checking edit attributes.

Checks:

```bash
npx next typegen && npx tsc --noEmit   # types (typegen refreshes route helper types)
npm run lint
npm run build                          # production build
```

## Routine tasks

| Task | How |
|---|---|
| Change copy, FAQs, guides, banners, nav | Storyblok (Visual Editor or the story form), then **Publish**; live within about a minute |
| Refresh sample content | [seeding.md](seeding.md) |
| Add a UI string | `lib/i18n.ts` (English and French) |
| Rotate the BigCommerce token | create a new token for the origin, update the variable, redeploy; old ones expire by themselves |
| Check editing | open a story in Storyblok's Visual Editor ([visual-editor.md](visual-editor.md)) |

### Renewing the BigCommerce Storefront token

The BigCommerce token expires; create a new one for each origin you serve (`POST /v3/storefront/api-token` with `channel_id`,
`expires_at` and a single `allowed_cors_origins` entry), update `BIGCOMMERCE_STOREFRONT_TOKEN`, and redeploy. A stale token shows up as
empty product sections and `[bigcommerce] … failed` messages in the server log.

## Deployment (Vercel)

| Item | Value |
|---|---|
| Production URL | https://storyblok-commerce-b2b.vercel.app |
| Staging URL | https://storyblok-commerce-b2b-git-staging-rza-kalfanes-projects.vercel.app (public) |
| Vercel project | `storyblok-commerce-b2b` (scope "Rza Kalfane's projects") |
| Source | GitHub `rezakalfane/storyblok-commerce-b2b` |
| Deploys | every push to `main` deploys **Production**; a GitHub Action rebuilds the `staging` branch from `main` (with an empty commit, so Vercel builds it), which deploys the **Preview**; other branches and pull requests also get previews |
| Variables | the storefront variables above in Production, Preview and Development (tokens marked *sensitive*); **no personal access token** |
| Protection | Vercel Authentication is off, so previews and the Visual Editor frame can load without a Vercel login |

Production and staging read the same Storyblok space: both show published content to visitors and draft content inside the Visual
Editor. Storyblok has no environments, so the staging site is for previewing **code** changes, and content is reviewed with the editor's
draft preview before publishing.

### Redeploying and changing variables

```bash
git push origin main                                   # deploys production automatically
vercel deploy --prod --scope rza-kalfanes-projects     # or deploy from your machine
printf '%s' "$VALUE" | vercel env add NAME production --sensitive --yes --scope rza-kalfanes-projects
vercel env ls --scope rza-kalfanes-projects            # names and scopes only
```

Changing a variable needs a redeploy to take effect.

## Deployment checklist for any host

1. Set every variable above in the hosting project (Production and Preview scopes). Do **not** set the personal access token.
2. Use the **Public** token for the live site and keep the Preview token for the Visual Editor deployments.
3. Create a BigCommerce Storefront token whose allowed origin is the **production domain**.
4. In Storyblok, set the Visual Editor environments to your domains (`scripts/seed/editor.py`, or Settings → Visual Editor).
5. The CSP `frame-ancestors` rule already allows Storyblok's editor. `proxy.ts` runs on the Node.js runtime.

### Production readiness checklist

- [x] Deployed on Vercel with GitHub auto-deploy and all variables set.
- [x] Live site reads published content with the Public token; drafts are only served for signed editor requests.
- [x] Visual Editor environments (Production, Staging, Local) and real paths configured.
- [ ] Confirm a Storyblok plan (the trial ends around 21 November 2026).
- [ ] Replace all fictional sample content (authors, article text, FAQ policies, promotions, contact details).
- [ ] Add a **publish webhook** to Next.js revalidation (tag `storyblok`) so published content shows immediately instead of within 60 seconds.
- [ ] Add BigCommerce **Store Translations** for French product content (or accept English product names).
- [ ] Decide the B2B account story: customer login, company price lists, quotes ([bigcommerce.md](bigcommerce.md)).
- [ ] `sitemap.xml`, `robots.txt`, canonical host, analytics, error monitoring.
- [ ] Review the cookie notice requirements for the cart cookie (`bc_cart_id`, strictly necessary).
- [ ] Run the checks (tsc, lint, build) and a manual pass on EN and FR: home, listing, product, cart, blog, guides, FAQ.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Pages render without images | image host not allowed | `images.remotePatterns` in `next.config.ts` (`a.storyblok.com`, BigCommerce CDN), then restart |
| Empty product sections, `[bigcommerce] … failed` in the log | expired/wrong Storefront token, wrong channel host, origin mismatch | see "Renewing the token" |
| Every page is a 404 or errors on `cdn/stories` | wrong `STORYBLOK_REGION`, space id or token | check the three variables; the region must match the space |
| Content changes not visible | not published, or within the 60-second cache | **Publish** the story and wait a minute |
| French page shows English text | the translatable field has no French value, or a UI string is missing | translate the field / add the string |
| `Functions cannot be passed directly to Client Components` | a callback prop from a Server Component | pass data (strings), not functions |
| Product page 404 | the BigCommerce path is not on the channel, or the product is not visible | check the product's channel assignment and visibility |
| Cart badge lags | the header reads the cart after the action revalidates (~1 s) | expected |
| Visual Editor problems | see [visual-editor.md](visual-editor.md#troubleshooting) | |
| `Cannot find module` after moving files | stale `.next` | stop the server, delete `.next`, restart |
| `PageProps` not found | route types not generated | `npx next typegen` |

## Logs and diagnostics

- Server logs include `[bigcommerce] … failed: <message>` and `[cart] … failed` lines. These are the first place to look.
- `curl -s -X POST https://store-<hash>-<channel>.mybigcommerce.com/graphql -H "Authorization: Bearer $TOKEN" …`
  reproduces any GraphQL call.
- Storyblok: `curl "https://api.storyblok.com/v2/cdn/stories/home?version=published&token=<public token>"` returns the published Home story;
  `python3 ~/.claude/skills/storyblok/scripts/sb_api.py GET /components` lists the model through the Management API.

## Known limitations

- No buyer sign-in, per-company pricing, quotes or order history (B2B Edition is not yet integrated).
- Product text is English only.
- Published content is cached for 60 seconds (no webhook revalidation yet).
- There is no approval gate between editing and publishing (the ContentStack version had a workflow and publishing rule; Storyblok
  offers workflows and stages as a separate feature that is not configured here).
- Live-edit updates use a per-process cache, which can be intermittent on serverless hosting; saving always reloads the page.
- Search on the blog is a simple in-memory text match over the 100 most recent posts.
