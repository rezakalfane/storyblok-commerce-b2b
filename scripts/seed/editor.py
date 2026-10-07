#!/usr/bin/env python3
"""Configure the Visual Editor for the space (idempotent): preview environments, and no real paths on stories.
Usage: python3 scripts/seed/editor.py

The editor opens `<environment URL><story slug>` (French: `fr/<slug>`). Do NOT set a "real path" on stories: Storyblok uses it as-is
and drops the language prefix, so the French editor would open the English page. Stories without a page of their own
(`home`, `faqs/...`, `spotlights/...`, `authors/...`, `settings/...`) are mapped to the page that shows them by `proxy.ts`.
Earlier versions of this script set real paths; running it clears them.
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
    cleared = 0
    for s in stories:
        if s.get("path"):
            sb.api("PUT", f"/stories/{s['id']}", body={"story": {"path": ""}, "publish": 1})
            cleared += 1
    print(f"  real path cleared on {cleared} stories ({len(stories)} total)")


if __name__ == "__main__":
    main()
