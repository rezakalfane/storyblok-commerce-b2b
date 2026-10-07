"use server";

import { refresh } from "next/cache";
import { previewGate } from "@/providers/cms/gates";
import { setLiveStory, type Story } from "./client";

/**
 * Stores the unsaved story the Visual Editor sends on every change and re-renders the open page in the same response (`refresh()`).
 * Only callable with the editor's own signed URL parameters (`search` is the page's query string, checked by the same gate as the
 * page itself); the story is only ever read for draft requests.
 */
export async function liveEditUpdate(search: string, story: Story): Promise<boolean> {
  if (!previewGate(new URLSearchParams(search))) return false;
  if (!story || typeof story.id !== "number" || !story.content || typeof story.content !== "object") return false;
  setLiveStory(story);
  refresh();
  return true;
}
