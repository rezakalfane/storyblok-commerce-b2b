import { API_KEY, APP_HOST, EDIT_MODE, ENVIRONMENT, type PreviewParams } from "@/lib/contentstack";
import { LivePreview } from "./live-preview";

/**
 * Loads Live Preview / Visual Editor tooling in preview, and in local development so editors can start editing.
 * The entry a page renders is declared with the SDK's documented <meta> tags (React hoists them into <head>),
 * so "Start Editing" opens the right entry even for custom-URL pages.
 */
export function EditSupport({ preview, entry }: { preview?: PreviewParams; entry?: { uid: string; contentType: string } }) {
  if (!preview && !EDIT_MODE) return null;
  return (
    <>
      {entry && (
        <>
          <meta name="contentstack:entry-uid" content={entry.uid} />
          <meta name="contentstack:content-type-uid" content={entry.contentType} />
        </>
      )}
      <LivePreview apiKey={API_KEY} environment={ENVIRONMENT} appHost={APP_HOST} />
    </>
  );
}
