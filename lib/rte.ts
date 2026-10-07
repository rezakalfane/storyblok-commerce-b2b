import { jsonToHTML } from "@contentstack/utils";

type RteEntry = Parameters<typeof jsonToHTML>[0]["entry"];

/** Converts a JSON RTE field on `holder` to HTML (in place) and returns the HTML string. */
export function rteToHtml(value: unknown): string {
  if (!value) return "";
  const holder = { v: value } as unknown as RteEntry;
  jsonToHTML({ entry: holder, paths: ["v"] });
  return (holder as unknown as { v: string }).v;
}
