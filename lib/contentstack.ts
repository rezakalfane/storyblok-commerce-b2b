import contentstack, { Region } from "@contentstack/delivery-sdk";
import { addEditableTags } from "@contentstack/utils";
import { CS_LOCALE, type Locale } from "./i18n";

const REGION = process.env.CONTENTSTACK_REGION ?? "us";

const regions: Record<string, Region> = {
  us: Region.US,
  eu: Region.EU,
  au: Region.AU,
  "azure-na": Region.AZURE_NA,
  "azure-eu": Region.AZURE_EU,
  "gcp-na": Region.GCP_NA,
};

const prefix = REGION === "us" ? "" : `${REGION}-`;
const PREVIEW_HOST = `${prefix}rest-preview.contentstack.com`;

/** Host of the Contentstack web app, used by the Live Preview editor frame. */
export const APP_HOST = `${prefix}app.contentstack.com`;
export const API_KEY = process.env.CONTENTSTACK_API_KEY!;
export const ENVIRONMENT = process.env.CONTENTSTACK_ENVIRONMENT!;

/** Query params Contentstack appends to the preview URL inside the Live Preview pane. */
export type PreviewParams = {
  live_preview?: string;
  content_type_uid?: string;
  entry_uid?: string;
  preview_timestamp?: string;
  release_id?: string;
};

const baseConfig = () => ({
  apiKey: API_KEY,
  deliveryToken: process.env.CONTENTSTACK_DELIVERY_TOKEN!,
  environment: ENVIRONMENT,
  region: regions[REGION] ?? Region.US,
});

const defaultStack = contentstack.stack(baseConfig());

/**
 * Returns the shared delivery stack, or a fresh per-request stack in Live Preview.
 * `livePreviewQuery` mutates the stack, so preview requests must never share an instance.
 */
export function getStack(preview?: PreviewParams) {
  if (!preview?.live_preview) return defaultStack;
  const stack = contentstack.stack({
    ...baseConfig(),
    live_preview: {
      enable: true,
      preview_token: process.env.CONTENTSTACK_PREVIEW_TOKEN!,
      host: PREVIEW_HOST,
    },
  });
  stack.livePreviewQuery({
    live_preview: preview.live_preview,
    content_type_uid: preview.content_type_uid,
    entry_uid: preview.entry_uid,
    preview_timestamp: preview.preview_timestamp,
    release_id: preview.release_id,
  });
  return stack;
}

/** Picks the preview params out of a Next.js `searchParams` object. */
export function previewParams(
  sp: Record<string, string | string[] | undefined>,
): PreviewParams | undefined {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const live_preview = one(sp.live_preview);
  if (!live_preview) return undefined;
  return {
    live_preview,
    content_type_uid: one(sp.content_type_uid),
    entry_uid: one(sp.entry_uid),
    preview_timestamp: one(sp.preview_timestamp),
    release_id: one(sp.release_id),
  };
}

/** Entries of a content type in the given locale, falling back to the default locale when untranslated. */
export function entriesOf(contentType: string, locale: Locale, preview?: PreviewParams) {
  const entries = getStack(preview).contentType(contentType).entry().locale(CS_LOCALE[locale]).includeFallback();
  // In preview, referenced entries must carry their content type uid so nested edit tags resolve.
  return preview ? entries.includeReferenceContentTypeUID() : entries;
}

/**
 * Adds Visual Editor / Live Preview edit tags (`entry.$.<field>` -> `data-cslp` attributes) to an entry and
 * everything nested in it. Only done in preview, so production HTML stays free of editing markup.
 */
export function tagEntry<T>(entry: T, contentType: string, locale: Locale, preview?: PreviewParams): T {
  if (preview && entry) {
    addEditableTags(entry as never, contentType, true, CS_LOCALE[locale]);
  }
  return entry;
}

/** True when edit tooling should load even outside preview (local development, or CONTENTSTACK_EDIT_MODE=true). */
export const EDIT_MODE = process.env.NODE_ENV !== "production" || process.env.CONTENTSTACK_EDIT_MODE === "true";

/** Drops repeated entries (same uid). The preview API can return an entry twice, which breaks React keys. */
export function uniqueByUid<T extends { uid?: string }>(entries: T[]): T[] {
  const seen = new Set<string>();
  return entries.filter((e) => !e.uid || (!seen.has(e.uid) && seen.add(e.uid)));
}
