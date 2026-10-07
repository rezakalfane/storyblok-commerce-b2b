import { EditSupport as Storyblok } from "@/providers/cms/storyblok/edit-support";
import { isPreviewRequest } from "@/lib/request";

/**
 * Loads Storyblok's Visual Editor bridge, only for requests the proxy verified as an editor's preview (x-preview). Click-to-edit works
 * from the edit attributes in the HTML (`$` on the content, see core/edit.ts); the bridge adds live updates on top.
 */
export async function EditSupport() {
  return (await isPreviewRequest()) ? <Storyblok /> : null;
}
