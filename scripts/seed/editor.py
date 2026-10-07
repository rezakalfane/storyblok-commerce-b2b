#!/usr/bin/env python3
"""Configure the Visual Editor for the space (idempotent): preview environments and the real path of each story.
Usage: python3 scripts/seed/editor.py

The editor opens `<environment URL><story path>` (French: `fr/<path>`), so stories without a page of their own point at the
page that shows them, and Home points at `/`.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import sb  # noqa: E402

ENVIRONMENTS = [
    {"name": "Production", "location": "https://storyblok-commerce-b2b.vercel.app/"},
    {"name": "Staging", "location": "https://storyblok-commerce-b2b-git-staging-rza-kalfanes-projects.vercel.app/"},
    {"name": "Local (npm run dev:https)", "location": "https://localhost:3000/"},
]

# folder (or exact slug) -> real path of the page that displays it
PATHS = {"home": "/", "faqs/": "/faq", "spotlights/": "/", "authors/": "/blog", "settings/": "/"}


def main():
    sb.api("PUT", "", body={"space": {"domain": ENVIRONMENTS[0]["location"], "environments": ENVIRONMENTS}})
    print("  preview environments:", ", ".join(e["name"] for e in ENVIRONMENTS))
    page = 1
    stories = []
    while True:
        batch = sb.api("GET", "/stories", params={"per_page": 100, "page": page, "is_folder": 0}).get("stories", [])
        stories += batch
        if len(batch) < 100:
            break
        page += 1
    changed = 0
    for s in stories:
        want = next((p for k, p in PATHS.items() if s["full_slug"] == k or (k.endswith("/") and s["full_slug"].startswith(k))), None)
        if want is not None and s.get("path") != want:
            sb.api("PUT", f"/stories/{s['id']}", body={"story": {"path": want}, "publish": 1})
            changed += 1
    print(f"  real path set on {changed} stories ({len(stories)} total)")


if __name__ == "__main__":
    main()
