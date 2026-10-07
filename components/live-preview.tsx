"use client";

import { useEffect } from "react";
import ContentstackLivePreview from "@contentstack/live-preview-utils";

type Props = {
  apiKey: string;
  environment: string;
  appHost: string;
};

// The SDK must be initialised exactly once per page load, however many components ask for it.
let ready: Promise<unknown> | undefined;

/**
 * Boots Contentstack Live Preview + Visual Editor (SSR mode: every edit in the entry form makes the preview
 * pane request fresh HTML, which our server components render from the unsaved draft).
 * `mode: "builder"` points "Start Editing" at Visual Editor; `data-cslp` tags make fields click-to-edit.
 * Which entry a page renders is declared with <meta> tags (see EditSupport), not `setPageContext`, because
 * that posts a message to the Visual Builder and logs an error when there is no builder to acknowledge it
 * (for example in Timeline mode).
 */
export function LivePreview({ apiKey, environment, appHost }: Props) {
  useEffect(() => {
    ready ??= ContentstackLivePreview.init({
      ssr: true,
      enable: true,
      mode: "builder",
      stackDetails: { apiKey, environment },
      clientUrlParams: { protocol: "https", host: appHost, port: 443 },
      editButton: { enable: true, position: "top-right" },
      editInVisualBuilderButton: { enable: true, position: "bottom-right" },
      // Our hero images sit under a gradient overlay; let the SDK see fields that are visually covered.
      overlayPropagation: { enable: true },
    });
  }, [apiKey, environment, appHost]);

  return null;
}
