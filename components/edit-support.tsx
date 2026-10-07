import { StoryblokLiveEditing } from "@storyblok/react/rsc";
import type { PreviewParams } from "@/lib/storyblok";

/**
 * Loads the Storyblok bridge for the story a page renders, only when the page is opened in the Visual Editor.
 * Click-to-edit works from the `data-blok-*` attributes in the HTML (see `editTags`). While editing, the bridge sends the
 * unsaved story to the server, which re-renders the page from it (live preview); saving reloads the page.
 * `relations` lists the reference fields that should arrive resolved in those live updates.
 */
export function EditSupport({ preview, entry, relations }: { preview?: PreviewParams; entry?: { id: number }; relations?: string[] }) {
  if (!preview || !entry) return null;
  return <StoryblokLiveEditing story={{ id: entry.id } as never} bridgeOptions={{ resolveRelations: relations }} />;
}
