#!/usr/bin/env python3
"""Create/update the Storyblok components (content model) and the space languages. Idempotent.
Usage: python3 tools/storyblok/schemas.py [--prune]

Conventions: field-level translation (translatable fields get `__i18n__fr` siblings), enums store fixed English values,
lists of strings are one-per-line textareas, references to other stories are `option(s)` fields over internal stories.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import sb  # noqa: E402

# ------------------------------------------------------------ field builders
_pos = 0


def _f(type_, **kw):
    global _pos
    _pos += 1
    return {"type": type_, "pos": _pos, **kw}


def text(t=True, required=False, description=""):
    return _f("text", translatable=t, required=required, description=description)


def textarea(t=True, required=False, description=""):
    return _f("textarea", translatable=t, required=required, description=description)


def rich(t=True, required=False):
    return _f("richtext", translatable=t, required=required)


def number(description=""):
    return _f("number", description=description)


def boolean(default=False):
    return _f("boolean", default_value=default)


def date():
    return _f("datetime", disable_time=False)


def image(required=False):
    return _f("asset", filetypes=["images"], required=required)


def select(choices, default=""):
    return _f("option", options=[{"name": c, "value": c} for c in choices], default_value=default)


def ref(to, multiple=False):
    return _f("options" if multiple else "option", source="internal_stories", filter_content_type=[to], entry_appearance="card" if multiple else "link")


def refs_any(to):
    return _f("options", source="internal_stories", filter_content_type=list(to), entry_appearance="card")


def bloks(*allowed, maximum=None):
    f = _f("bloks", restrict_components=True, component_whitelist=list(allowed))
    if maximum:
        f["maximum"] = maximum
    return f


def seo():
    return {"seo_title": text(), "seo_description": textarea()}


# ------------------------------------------------------------ components
TOPICS = ["Ordering", "Pricing & Credit", "Delivery & Returns", "Account & Users", "Products & Fitment"]
AUDIENCES = ["Workshops", "Fleet managers", "Leisure & marine", "Everyone"]
BADGES = ["None", "Best seller", "Trade favourite", "New in", "Heavy duty"]

NESTABLE = {
    "hero_banner": ("Hero banner", {
        "title": text(required=True), "description": textarea(), "image": image(),
        "cta_label": text(), "cta_href": text(t=False, description="Path on the storefront, e.g. /guides"),
        "second_image": image(), "variant": select(["default", "home"], "default"),
    }),
    "feature_block": ("Feature block", {
        "title": text(required=True), "copy": rich(), "image": image(),
        "layout": select(["image_left", "image_right"], "image_left"),
    }),
    "text_block": ("Text block", {"text": rich(required=True)}),
    "image_block": ("Image block", {"image": image(required=True), "alt": text()}),
    "video_block": ("Video block", {"video_title": text(), "src": text(t=False, required=True, description="Video file URL")}),
    "collection_block": ("Collection block", {
        "kind": select(["categories", "spotlights", "guides", "posts", "postListing", "guideListing", "faqs"], "guides"),
        "title": text(), "link_label": text(), "search_placeholder": text(), "search_button_label": text(),
        "items": refs_any(["buying_guide", "product_spotlight", "blog_post", "faq"]),
    }),
    "guide_step": ("Guide step", {"step_title": text(required=True), "step_body": textarea(required=True), "pro_tip": textarea()}),
    "use_case": ("Use case", {"use_case": text(required=True), "description": textarea()}),
    "nav_link": ("Navigation link", {"label": text(required=True), "href": text(t=False, required=True), "highlight": boolean()}),
    "footer_column": ("Footer column", {"heading": text(required=True), "links": bloks("nav_link")}),
}

ROOT_TYPES = {
    "page": ("Page", {
        "title": text(required=True), "description": textarea(),
        "components": bloks("hero_banner", "feature_block", "text_block", "image_block", "video_block", "collection_block"), **seo(),
    }),
    "author": ("Author", {"name": text(t=False, required=True), "picture": image(required=True), "bio": textarea()}),
    "blog_post": ("Blog post", {
        "title": text(required=True), "author": ref("author"), "date": date(), "featured_image": image(required=True),
        "related_post": ref("blog_post"), "is_archived": boolean(), **seo(), "seo_keywords": text(),
        "content": bloks("text_block", "image_block", "video_block"), "read_time": number(),
    }),
    "faq": ("FAQ", {
        "question": text(required=True), "answer": rich(required=True), "topic": select(TOPICS, TOPICS[0]),
        "sort_order": number("Lower numbers appear first within a topic."), "is_featured": boolean(),
    }),
    "buying_guide": ("Buying guide", {
        "title": text(required=True), "summary": textarea(required=True), "hero_image": image(),
        "audience": select(AUDIENCES, "Everyone"), "read_minutes": number(), "steps": bloks("guide_step"),
        "checklist": textarea(description="One 'before you order' check per line."),
        "recommended_bc_products": text(t=False, description="BigCommerce product IDs, comma-separated."),
        "recommended_skus": text(t=False, description="SKUs, comma-separated."),
        "related_faqs": ref("faq", True), "author": ref("author"),
    }),
    "product_spotlight": ("Product spotlight", {
        "title": text(required=True), "bc_product_id": number("Entity ID in the BigCommerce catalog."), "bc_sku": text(t=False),
        "tagline": text(required=True), "editorial_summary": rich(), "key_features": textarea(description="One feature per line."),
        "use_cases": bloks("use_case"), "pairs_well_with_skus": text(t=False, description="SKUs, comma-separated."),
        "badge": select(BADGES, "None"), "editorial_image": image(), "is_featured": boolean(),
    }),
    "announcement_bar": ("Announcement bar", {
        "title": text(t=False, required=True, description="Internal name."), "message": text(required=True),
        "cta_label": text(), "cta_href": text(t=False),
        "style": select(["info", "promo", "warning"], "info"), "audience": select(["everyone", "logged_in", "guests"], "everyone"),
        "starts_at": date(), "ends_at": date(), "is_active": boolean(True),
    }),
    "site_navigation": ("Site navigation", {
        "title": text(t=False, required=True, description="Internal name."), "header_links": bloks("nav_link"),
        "footer_columns": bloks("footer_column"), "sales_email": text(t=False), "support_phone": text(t=False),
        "opening_hours": text(), "legal_text": text(),
    }),
}


def components():
    for name, (display, schema) in NESTABLE.items():
        yield {"name": name, "display_name": display, "schema": schema, "is_root": False, "is_nestable": True}
    for name, (display, schema) in ROOT_TYPES.items():
        yield {"name": name, "display_name": display, "schema": schema, "is_root": True, "is_nestable": False}


def remove_components(existing, prune):
    """Components no longer in the model: listed, and with `prune` their stories and the component are deleted."""
    keep = set(NESTABLE) | set(ROOT_TYPES)
    for name, comp in existing.items():
        if name in keep or name in ("feature", "grid", "teaser"):
            continue
        stories = sb.api("GET", "/stories", params={"contain_component": name, "per_page": 100}).get("stories", [])
        if not prune:
            print(f"  {name}: no longer in the model ({len(stories)} stories); run with --prune to delete")
            continue
        for st in stories:
            sb.api("DELETE", f"/stories/{st['id']}")
        sb.api("DELETE", f"/components/{comp['id']}")
        print(f"  {name}: deleted with {len(stories)} stories")


def main():
    space = sb.api("GET", "")["space"]
    if "fr" not in [l["code"] for l in space.get("languages", [])]:
        sb.api("PUT", "", body={"space": {"languages": [{"code": "fr", "name": "French"}]}})
        print("  added language fr")

    existing = {c["name"]: c for c in sb.api("GET", "/components")["components"]}
    for old in ("feature", "grid", "teaser"):  # blueprint components replaced by the model below (the Home story is rewritten by seed.py)
        if old in existing:
            print(f"  (kept blueprint component '{old}' until the home story is rewritten)")
    for comp in components():
        global _pos
        if comp["name"] in existing:
            sb.api("PUT", f"/components/{existing[comp['name']]['id']}", body={"component": comp})
            print(f"  updated {comp['name']}")
        else:
            sb.api("POST", "/components", body={"component": comp})
            print(f"  created {comp['name']}")
    remove_components(existing, "--prune" in sys.argv)


if __name__ == "__main__":
    main()
