#!/usr/bin/env python3
"""Add this site's preview environments to the Storyblok Visual Editor (idempotent; other environments are kept).
Usage: python3 tools/storyblok/editor.py

The editor opens `<environment URL><story slug>` (French: `fr/<slug>`), e.g. `https://<site>/pages/home` or `https://<site>/fr/pages/faq`.
`proxy.ts` serves those slugs (pages/*, faqs/*, authors/*, spotlights/*, settings/*) for editor requests only. Do NOT set a "real path"
on stories: Storyblok uses it as-is and drops the language prefix, so the French editor would open the English page.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import sb  # noqa: E402

MINE = [
    {"name": "Production", "location": os.environ.get("PREVIEW_PRODUCTION", "https://storyblok-commerce-b2b.vercel.app") + "/"},
    {"name": "Staging", "location": os.environ.get("PREVIEW_STAGING", "https://storyblok-commerce-b2b-git-staging-rza-kalfanes-projects.vercel.app") + "/"},
    {"name": "Local (npm run dev:https)", "location": "https://localhost:3000/"},
]


def main():
    space = sb.api("GET", "")["space"]
    current = space.get("environments") or []
    mine = {e["name"] for e in MINE}
    merged = [e for e in current if e["name"] not in mine] + MINE
    sb.api("PUT", "", body={"space": {"environments": merged}})
    for e in MINE:
        print(f"  environment: {e['name']} -> {e['location']}")
    print(f"  {len(merged)} environments in the space ({len(current)} before)")


if __name__ == "__main__":
    main()
