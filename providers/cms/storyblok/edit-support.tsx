import { LiveEditing } from "./live-editing";

/** Loads Storyblok's Visual Editor bridge (see ./live-editing.tsx). Rendered only for verified preview requests, see components/edit-support.tsx. */
export function EditSupport() {
  return <LiveEditing />;
}
