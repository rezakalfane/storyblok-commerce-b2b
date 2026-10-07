#!/usr/bin/env python3
"""Save everything in the space (components, stories with content) as JSON before a destructive change such as `schemas.py --prune`.
Usage: python3 tools/storyblok/backup.py   -> .backups/storyblok-<timestamp>.json (gitignored; never commit it)
"""
import datetime as dt
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import sb  # noqa: E402


def main():
    stories, page = [], 1
    while True:
        batch = sb.api("GET", "/stories", params={"per_page": 100, "page": page}).get("stories", [])
        # the list has no content: read each story in full
        stories += [sb.api("GET", f"/stories/{s['id']}")["story"] for s in batch]
        if len(batch) < 100:
            break
        page += 1
    data = {"components": sb.api("GET", "/components")["components"], "stories": stories, "space": sb.api("GET", "")["space"]}
    out = os.path.join(sb.ROOT, ".backups")
    os.makedirs(out, exist_ok=True)
    path = os.path.join(out, f"storyblok-{dt.datetime.now().strftime('%Y%m%d-%H%M%S')}.json")
    with open(path, "w") as f:
        json.dump(data, f)
    print(f"saved {len(data['components'])} components, {len(stories)} stories -> {os.path.relpath(path, sb.ROOT)}")


if __name__ == "__main__":
    main()
