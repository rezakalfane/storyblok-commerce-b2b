"use client";

import { loadStoryblokBridge, registerStoryblokBridge } from "@storyblok/js";
import { startTransition, useEffect } from "react";
import { liveEditUpdate } from "./actions";
import type { Story } from "./client";

/** Relation fields the bridge resolves in the stories it sends (`component.field`), so collections show their items while editing. */
const RESOLVE_RELATIONS = ["collection_block.items", "blog_post.author", "buying_guide.author", "buying_guide.related_faqs"];

/**
 * Starts Storyblok's Visual Editor bridge for the story open in the editor (its id is the `_storyblok` URL parameter). Click-to-edit
 * works from the `data-blok-*` attributes in the HTML; on every change the bridge sends the whole unsaved story, which goes to the
 * server (`liveEditUpdate`) and the page is re-rendered with it in the same response. Saving or publishing reloads the page.
 */
export function LiveEditing() {
  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get("_storyblok"));
    if (!id || window.self === window.top) return;
    const send = (story: Story) => startTransition(() => void liveEditUpdate(window.location.search, story));
    // Development only: lets tests send a story through the same handler the bridge uses.
    if (process.env.NODE_ENV !== "production") (window as unknown as { __liveEdit?: (s: Story) => void }).__liveEdit = send;

    let cancelled = false;
    void loadStoryblokBridge()
      .then(() => {
        if (!cancelled) registerStoryblokBridge(id, (story) => send(story as unknown as Story), { resolveRelations: RESOLVE_RELATIONS });
      })
      .catch((e) => console.warn("Storyblok bridge not started:", e instanceof Error ? e.message : e));
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
