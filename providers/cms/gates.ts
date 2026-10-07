import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Draft gate: does this request carry the Visual Editor's signed preview parameters? Run by `proxy.ts`, which then sets the trusted
 * `x-preview` header. The editor adds `_storyblok` and a signature: sha1 of `space:previewToken:timestamp`, issued less than an hour
 * ago; a bare `?_storyblok=1` never unlocks drafts in production. In local development the flag alone is enough.
 */
export function previewGate(params: URLSearchParams): boolean {
  if (!params.get("_storyblok")) return false;
  if (process.env.NODE_ENV !== "production") return true;
  const space = params.get("_storyblok_tk[space_id]");
  const timestamp = params.get("_storyblok_tk[timestamp]");
  const token = params.get("_storyblok_tk[token]");
  if (!space || !timestamp || !token || space !== process.env.STORYBLOK_SPACE_ID) return false;
  const fresh = Math.abs(Date.now() / 1000 - Number(timestamp)) < 3600;
  const valid = createHash("sha1").update(`${space}:${process.env.STORYBLOK_PREVIEW_TOKEN ?? ""}:${timestamp}`).digest("hex");
  const a = Buffer.from(valid);
  const b = Buffer.from(token);
  return fresh && a.length === b.length && timingSafeEqual(a, b);
}
