"""Storyblok Management API helper for the seeding scripts (stdlib only, secrets never printed).

Credentials come from ../../.env.local: STORYBLOK_SPACE_ID, STORYBLOK_REGION, STORYBLOK_OAUTH_TOKEN.
"""
import json
import mimetypes
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
IMG_DIR = os.environ.get("SEED_IMG_DIR", os.path.join(ROOT, ".seed-images"))

MAPI_HOSTS = {"eu": "mapi.storyblok.com", "us": "api-us.storyblok.com", "ca": "api-ca.storyblok.com", "ap": "api-ap.storyblok.com"}


def load_env():
    env = {}
    with open(os.path.join(ROOT, ".env.local")) as f:
        for line in f:
            m = re.match(r"^([A-Z0-9_]+)=([^#\s]*)", line.strip())
            if m:
                env[m.group(1)] = m.group(2).strip("\"'")
    return env


ENV = load_env()
SPACE = ENV["STORYBLOK_SPACE_ID"]
BASE = f"https://{MAPI_HOSTS[ENV.get('STORYBLOK_REGION', 'eu').lower()]}/v1/spaces/{SPACE}"
TOKEN = ENV["STORYBLOK_OAUTH_TOKEN"]


def redact(text):
    return text.replace(TOKEN, "***")


def _request(method, url, data=None, headers=None):
    for attempt in range(8):
        req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                raw = resp.read()
                time.sleep(0.34)  # Management API: ~3 requests per second
                return json.loads(raw) if raw and raw.strip()[:1] in (b"{", b"[") else {}
        except urllib.error.HTTPError as e:
            raw = e.read().decode(errors="replace")
            if e.code == 429 and attempt < 7:
                time.sleep(1.5 + attempt)
                continue
            sys.exit(redact(f"{method} {url.split('/v1/')[-1]} -> HTTP {e.code}: {raw[:900]}"))
    sys.exit("retries exhausted")


def api(method, path, body=None, params=None):
    url = BASE + path + ("?" + urllib.parse.urlencode(params) if params else "")
    headers = {"Authorization": TOKEN}
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    return _request(method, url, data, headers)


# ---------------------------------------------------------------- assets
_assets_cache = {}


def upload_asset(path, alt=""):
    """Uploads a local image (idempotent by file name) and returns the Storyblok asset field value."""
    name = os.path.basename(path)
    if name not in _assets_cache:
        found = api("GET", "/assets", params={"search": name, "per_page": 100}).get("assets", [])
        _assets_cache.update({a["filename"].rsplit("/", 1)[-1]: a for a in found})
    asset = _assets_cache.get(name)
    if not asset:
        from PIL import Image
        with Image.open(path) as im:
            size = f"{im.width}x{im.height}"
        sign = api("POST", "/assets", body={"filename": name, "size": size, "validate_upload": 1})
        ctype = mimetypes.guess_type(path)[0] or "application/octet-stream"
        boundary = uuid.uuid4().hex
        parts = [f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode() for k, v in sign["fields"].items()]
        with open(path, "rb") as f:
            content = f.read()
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\nContent-Type: {ctype}\r\n\r\n'.encode()
                     + content + b"\r\n")
        parts.append(f"--{boundary}--\r\n".encode())
        _request("POST", sign["post_url"], b"".join(parts), {"Content-Type": f"multipart/form-data; boundary={boundary}"})
        api("GET", f"/assets/{sign['id']}/finish_upload")
        asset = {"id": sign["id"], "filename": sign["pretty_url"]}
        _assets_cache[name] = asset
    return {"id": asset["id"], "alt": alt, "name": "", "focus": "", "title": alt, "source": "", "filename": ("https:" if asset["filename"].startswith("//") else "") + asset["filename"],
            "copyright": "", "fieldtype": "asset", "meta_data": {}}


# ---------------------------------------------------------------- stories
def find_story(full_slug):
    r = api("GET", "/stories", params={"with_slug": full_slug})
    return (r.get("stories") or [None])[0]


def upsert_story(full_slug, name, content, parent_id=None, is_startpage=False, publish=True):
    """Creates or updates the story at `full_slug` (a folder path plus slug) and publishes it. Returns the story."""
    existing = find_story(full_slug)
    slug = full_slug.rsplit("/", 1)[-1]
    story = {"name": name, "slug": slug, "content": content}
    if existing:
        story["content"] = content
        r = api("PUT", f"/stories/{existing['id']}", body={"story": story, "publish": 1 if publish else 0})
    else:
        if parent_id:
            story["parent_id"] = parent_id
        if is_startpage:
            story["is_startpage"] = True
        r = api("POST", "/stories", body={"story": story, "publish": 1 if publish else 0})
    return r["story"]


def upsert_startpage(folder, name, content):
    """The folder's root story (served at the folder's URL, e.g. /blog). Created on first use, updated afterwards."""
    existing = find_story(folder["full_slug"] + "/")
    story = {"name": name, "content": content}
    if existing:
        return api("PUT", f"/stories/{existing['id']}", body={"story": story, "publish": 1})["story"]
    story.update(slug="index", parent_id=folder["id"], is_startpage=True)
    return api("POST", "/stories", body={"story": story, "publish": 1})["story"]


def ensure_folder(slug, name, default_root=None):
    existing = find_story(slug)
    if existing:
        return existing
    folder = {"name": name, "slug": slug, "is_folder": True}
    if default_root:
        folder["default_root"] = default_root
    return api("POST", "/stories", body={"story": folder})["story"]


# ---------------------------------------------------------------- rich text
def richtext(spec):
    """Storyblok richtext document from [("p", text) | ("h2", text) | ("ul", [items])]; text may contain <a href> links."""
    def inline(text):
        out, pos = [], 0
        for m in re.finditer(r'<a href="([^"]+)">(.*?)</a>', text):
            if m.start() > pos:
                out.append({"type": "text", "text": text[pos:m.start()]})
            out.append({"type": "text", "text": m.group(2), "marks": [{"type": "link", "attrs": {"href": m.group(1), "uuid": None, "anchor": None, "target": None, "linktype": "url"}}]})
            pos = m.end()
        if pos < len(text):
            out.append({"type": "text", "text": text[pos:]})
        return out

    content = []
    for kind, val in spec:
        if kind == "p":
            content.append({"type": "paragraph", "content": inline(val)})
        elif kind == "h2":
            content.append({"type": "heading", "attrs": {"level": 2}, "content": inline(val)})
        elif kind == "ul":
            content.append({"type": "bullet_list", "content": [{"type": "list_item", "content": [{"type": "paragraph", "content": inline(i)}]} for i in val]})
    return {"type": "doc", "content": content}


def html_paragraphs(html):
    """Splits simple '<p>…</p><p>…</p>' HTML into richtext paragraphs."""
    return richtext([("p", p) for p in re.findall(r"<p>(.*?)</p>", html, flags=re.S)])


def slugify(s):
    s = s.lower().replace("&", "and")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")
