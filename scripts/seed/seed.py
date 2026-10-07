#!/usr/bin/env python3
"""Load the storefront content into Storyblok (English + French, field-level translation), publishing as it goes.
Idempotent: assets are reused by file name, stories are looked up by slug and updated in place.
Usage: python3 scripts/seed/seed.py [--only authors,faqs,posts,guides,spotlights,settings,pages]
"""
import datetime as dt
import os
import sys
import textwrap
import uuid

sys.path.insert(0, os.path.dirname(__file__))
import images  # noqa: E402
import photos  # noqa: E402
import sb  # noqa: E402
from content import AUTHORS, POSTS  # noqa: E402
from content_extra import ANNOUNCEMENTS, FAQS, GUIDES, HOME, NAV, P, SPOTLIGHTS  # noqa: E402
from content_fr import (  # noqa: E402
    ANNOUNCEMENTS_FR, AUTHOR_BIOS_FR, BLOG_LISTING_FR, FAQS_FR, GUIDES_FR, HEROES_FR, HOME_FR, NAV_FR, PAGES_FR,
    SPOTLIGHT_SUMMARY_FR, SPOTLIGHTS_FR, THEME_KEYWORDS_FR,
)
from content_fr_posts import POSTS_FR  # noqa: E402

IMG = sb.IMG_DIR
slugify, richtext = sb.slugify, sb.richtext


# ---------------------------------------------------------------- helpers
def blok(component, **fields):
    return {"_uid": str(uuid.uuid4()), "component": component, **fields}


def tr(content, key, en, fr):
    """Sets a translatable field: the default (English) value plus its French `__i18n__fr` sibling."""
    content[key] = en
    content[f"{key}__i18n__fr"] = fr


def lines(items):
    return "\n".join(items)


def asset(path, alt):
    return sb.upload_asset(path, alt)


def rt(spec):
    return richtext(spec)


def hero(title, desc, cta, href, image, fr):
    """A hero_banner blok. `fr` = (title, description, cta label)."""
    b = blok("hero_banner", image=image, cta_href=href, full_width=True)
    tr(b, "title", title, fr[0])
    tr(b, "description", desc, fr[1])
    tr(b, "cta_label", cta, fr[2])
    return b


def sections(only):
    return None if only is None else set(only.split(","))


# ---------------------------------------------------------------- seeding
def main():
    only = sections(sys.argv[sys.argv.index("--only") + 1]) if "--only" in sys.argv else None
    want = lambda name: only is None or name in only  # noqa: E731
    os.makedirs(IMG, exist_ok=True)

    folders = {n: sb.ensure_folder(n, label, root) for n, label, root in (
        ("blog", "Blog", "blog_post"), ("guides", "Buying guides", "buying_guide"), ("authors", "Authors", "author"),
        ("faqs", "FAQs", "faq"), ("spotlights", "Product spotlights", "product_spotlight"), ("settings", "Site settings", None))}
    uuids = {}  # story key -> uuid, for references

    # ---- authors
    if want("authors") or want("posts") or want("guides"):
        print("== authors")
        for a, bio_fr in zip(AUTHORS, AUTHOR_BIOS_FR):
            slug = slugify(a["name"])
            p = os.path.join(IMG, f"author-{slug}.png")
            images.make_avatar(a, p)
            c = {"component": "author", "name": a["name"], "picture": asset(p, a["name"])}
            tr(c, "bio", a["bio"], bio_fr)
            uuids[("author", a["name"])] = sb.upsert_story(f"authors/{slug}", a["name"], c, folders["authors"]["id"])["uuid"]
            print(f"  {a['name']}")

    # ---- FAQs
    if want("faqs") or want("guides"):
        print("== faqs")
        for i, ((topic, q, paras, featured), (q_fr, answers_fr)) in enumerate(zip(FAQS, FAQS_FR)):
            c = {"component": "faq", "topic": topic, "sort_order": str(i), "is_featured": featured}
            tr(c, "question", q, q_fr)
            tr(c, "answer", rt([("p", t) for t in paras]), rt([("p", t) for t in answers_fr]))
            uuids[("faq", q)] = sb.upsert_story(f"faqs/{slugify(q)[:60]}", q, c, folders["faqs"]["id"])["uuid"]
        print(f"  {len(FAQS)} faqs")

    # ---- blog posts
    flat = [(ai, pi, p) for ai, posts in enumerate(POSTS) for pi, p in enumerate(posts)]
    flat_fr = [p for posts in POSTS_FR for p in posts]
    post_uuid = []
    if want("posts"):
        print("== blog posts")
        start = dt.datetime(2026, 1, 12, 9, 0)
        for idx, ((ai, pi, (title, intro, s1, s2, takeaways)), fr) in enumerate(zip(flat, flat_fr)):
            slug = slugify(title)
            p = os.path.join(IMG, f"post-photo-{slug[:60]}.jpg")
            photos.crop(photos.PHOTOS[(ai * 2 + pi) % len(photos.PHOTOS)], (1600, 900), idx, p)
            when = start + dt.timedelta(days=7 * (pi * 6 + ai))
            t_fr, intro_fr, s1_fr, s2_fr, take_fr = fr
            c = {
                "component": "blog_post", "author": uuids[("author", AUTHORS[ai]["name"])], "date": when.strftime("%Y-%m-%d %H:%M"),
                "featured_image": asset(p, title), "is_archived": False,
                "seo_keywords": "b2b commerce, " + AUTHORS[ai]["theme"].lower(),
                "seo_keywords__i18n__fr": "commerce b2b, " + THEME_KEYWORDS_FR[ai],
            }
            tr(c, "title", title, t_fr)
            tr(c, "body",
               rt([("p", intro), ("h2", s1[0]), ("p", s1[1]), ("h2", s2[0]), ("p", s2[1]), ("h2", "Key takeaways"), ("ul", takeaways)]),
               rt([("p", intro_fr), ("h2", s1_fr[0]), ("p", s1_fr[1]), ("h2", s2_fr[0]), ("p", s2_fr[1]), ("h2", "À retenir"), ("ul", take_fr)]))
            tr(c, "seo_title", title, t_fr)
            tr(c, "seo_description", intro[:155], textwrap.shorten(intro_fr, 155, placeholder="…"))
            # related post always points at an earlier post, which already has a uuid
            rel = idx - 7 if idx >= 7 else (idx - 1 if idx >= 1 else None)
            if rel is not None:
                c["related_post"] = post_uuid[rel]
            post_uuid.append(sb.upsert_story(f"blog/{slug}", title, c, folders["blog"]["id"])["uuid"])
            print(f"  [{idx + 1:02d}/36] {title[:60]}")

        print("== blog listing")
        hp = os.path.join(IMG, "blog-hero-photo.jpg")
        photos.crop("bat_moto", (1200, 900), 0, hp)
        L = BLOG_LISTING_FR
        h = HEROES_FR["blog"]
        latest = sorted(range(36), key=lambda i: -((flat[i][1] * 6 + flat[i][0])))
        c = {"component": "blog_listing_page", "featured_posts": [post_uuid[i] for i in latest[:3]], "related_posts": [post_uuid[i] for i in latest[3:6]],
             "hero": [hero("The B2B Commerce Blog", "Practical guidance on pricing, ordering, integrations, payments, sales and headless storefronts for B2B commerce teams.",
                           "Browse articles", "/blog", asset(hp, "Blog hero photo"), (h[0], h[1], h[2]))]}
        tr(c, "title", "Blog", L["title"])
        tr(c, "search_placeholder", "Search articles", L["placeholder"])
        tr(c, "search_button_label", "Search", L["search_button"])
        tr(c, "featured_title", "Latest articles", L["from_blog_title"])
        tr(c, "view_all_label", "View all articles", L["view_articles"])
        tr(c, "related_title", "Keep reading", L["widget_title"])
        tr(c, "seo_title", "The B2B Commerce Blog", h[0])
        tr(c, "seo_description", "Articles on B2B pricing, ordering, integrations, payments, sales and composable storefronts.", h[1])
        sb.upsert_startpage(folders["blog"], "Blog", c)

    # ---- product photos for guides / spotlights / home
    need_photos = want("spotlights") or want("pages")
    if need_photos:
        keys = {s[0] for s in SPOTLIGHTS}
        bc = images.bc_photos([P[k][0] for k in keys])
        photo = {k: bc[P[k][0]] for k in keys if P[k][0] in bc}

    # ---- buying guides
    GUIDE_PHOTOS = ["controle", "mea_voiture", "mea_solaire", "mea_pile", "mea_chargeur", "bat_moto"]
    if want("guides"):
        print("== buying guides")
        for gi, (g, gf) in enumerate(zip(GUIDES, GUIDES_FR)):
            slug = slugify(g["title"])
            p = os.path.join(IMG, f"guide-photo-{slug[:45]}.jpg")
            photos.crop(GUIDE_PHOTOS[gi], (1600, 600), 0, p)
            steps = []
            for (t, b, tip), (t_fr, b_fr, tip_fr) in zip(g["steps"], gf["steps"]):
                s = blok("guide_step")
                tr(s, "step_title", t, t_fr)
                tr(s, "step_body", b, b_fr)
                tr(s, "pro_tip", tip or "", tip_fr or "")
                steps.append(s)
            c = {"component": "buying_guide", "hero_image": asset(p, g["title"]), "audience": g["audience"], "read_minutes": str(g["minutes"]), "steps": steps,
                 "recommended_bc_products": ",".join(str(P[k][0]) for k in g["products"]), "recommended_skus": ",".join(P[k][1] for k in g["products"]),
                 "related_faqs": [uuids[("faq", q)] for q in g["faqs"]], "author": uuids[("author", AUTHORS[g["author"]]["name"])]}
            tr(c, "title", g["title"], gf["title"])
            tr(c, "summary", g["summary"], gf["summary"])
            tr(c, "checklist", lines(g["checklist"]), lines(gf["checklist"]))
            sb.upsert_story(f"guides/{slug}", g["title"], c, folders["guides"]["id"])
            print(f"  {g['title'][:60]}")

    # ---- product spotlights
    if want("spotlights"):
        print("== product spotlights")
        for si, ((key, title, tagline, badge, feats, uses, _pairs, featured), (tag_fr, feats_fr, uses_fr)) in enumerate(zip(SPOTLIGHTS, SPOTLIGHTS_FR)):
            pid, sku = P[key]
            p = os.path.join(IMG, f"spotlight-photo-{key}.png")
            images.compose([photo[key]], AUTHORS[si % 6]["colors"], (1200, 900), si * 7 + 2, p)
            ucs = []
            for (u, d), (u_fr, d_fr) in zip(uses, uses_fr):
                b = blok("use_case")
                tr(b, "use_case", u, u_fr)
                tr(b, "description", d, d_fr)
                ucs.append(b)
            c = {"component": "product_spotlight", "bc_product_id": str(pid), "bc_sku": sku, "badge": badge, "is_featured": featured, "use_cases": ucs,
                 "editorial_image": asset(p, title), "pairs_well_with_skus": ""}
            tr(c, "title", title, title)
            tr(c, "tagline", tagline, tag_fr)
            tr(c, "key_features", lines(feats), lines(feats_fr))
            tr(c, "editorial_summary",
               rt([("p", f"{tagline}."), ("p", "Check the specification against the vehicle's original battery before ordering, and see our buying guide for a step-by-step fitment check.")]),
               rt([("p", tag_fr + "."), ("p", SPOTLIGHT_SUMMARY_FR)]))
            sb.upsert_story(f"spotlights/{slugify(title)[:60]}", title, c, folders["spotlights"]["id"])
            print(f"  {title[:60]}")

    # ---- site settings: announcements + navigation
    if want("settings"):
        print("== announcements + navigation")
        for a, (_t, msg_fr, cta_fr) in zip(ANNOUNCEMENTS, ANNOUNCEMENTS_FR):
            c = {"component": "announcement_bar", "title": a["title"], "cta_href": a["cta"][1], "style": a["style"], "audience": a["audience"],
                 "starts_at": "2026-10-01 00:00", "ends_at": "2026-12-31 23:59", "is_active": True}
            tr(c, "message", a["message"], msg_fr)
            tr(c, "cta_label", a["cta"][0], cta_fr)
            sb.upsert_story(f"settings/{slugify(a['title'])}", a["title"], c, folders["settings"]["id"])

        def link(l_en, l_fr, href):
            b = blok("nav_link", href=href, highlight=False)
            tr(b, "label", l_en, l_fr)
            return b

        header = [link(l, lf, h) for (l, h), (lf, _) in zip(NAV["header"], NAV_FR["header"])]
        footer = []
        for (h, links), (h_fr, links_fr) in zip(NAV["footer"], NAV_FR["footer"]):
            col = blok("footer_column", links=[link(l, lf, u) for (l, u), (lf, _) in zip(links, links_fr)])
            tr(col, "heading", h, h_fr)
            footer.append(col)
        c = {"component": "site_navigation", "title": NAV["title"], "header_links": header, "footer_columns": footer,
             "sales_email": NAV["contact"][0], "support_phone": NAV["contact"][1]}
        tr(c, "opening_hours", NAV["contact"][2], NAV_FR["hours"])
        tr(c, "legal_text", NAV["legal"], NAV_FR["legal"])
        sb.upsert_story("settings/navigation", NAV["title"], c, folders["settings"]["id"])

    # ---- pages: home (/), FAQ (/faq), buying guides (/guides)
    if want("pages"):
        print("== pages")
        HERO_PHOTO = {"home": ("mea_voiture", (780, 1040)), "faq": ("alim", (1200, 900)), "guides": ("mea_pile", (1200, 900))}
        faq_hero = ("Frequently asked questions", "Quick answers for trade buyers on ordering, pricing and credit, delivery, accounts and fitment.", "Browse buying guides", "/guides")
        guides_hero = ("Buying guides", "Practical, step-by-step checklists for matching the right battery to the job, for workshops, fleets and leisure buyers.", "Read the FAQ", "/faq")
        heroes = {"home": ("Commerce B2B", HOME["description"], "Browse buying guides", "/guides"), "faq": faq_hero, "guides": guides_hero}
        hero_img = {}
        for key, (name, size) in HERO_PHOTO.items():
            hero_img[key] = asset(photos.crop(name, size, 0, os.path.join(IMG, f"hero-{key}-photo.jpg")), heroes[key][0])

        def page_hero(key):
            t, d, cta, href = heroes[key]
            tf, df, cf, _ = HEROES_FR[key]
            return [hero(t, d, cta, href, hero_img[key], (tf, df, cf))]

        # home
        blocks = []
        for i, ((t, copy, layout, _), (t_fr, copy_fr)) in enumerate(zip(HOME["blocks"], HOME_FR["blocks"])):
            p = os.path.join(IMG, f"home-block-photo-{i}.jpg")
            photos.crop(["mea_chargeur", "mea_outillage", "mea_solaire"][i], (1200, 800), 0, p)
            b = blok("feature_block", image=asset(p, t), layout=layout)
            tr(b, "title", t, t_fr)
            tr(b, "copy", sb.html_paragraphs(copy), sb.html_paragraphs(copy_fr))
            blocks.append(b)
        second = asset(photos.crop("mea_moto", (780, 1040), 0, os.path.join(IMG, "home-second-photo.jpg")), "Home hero second photo")
        c = {"component": "page", "hero": page_hero("home"), "image": second, "blocks": blocks}
        tr(c, "title", HOME["title"], HOME["title"])
        tr(c, "description", HOME["description"], HOME_FR["description"])
        tr(c, "intro", sb.html_paragraphs(HOME["rich_text"]), sb.html_paragraphs(HOME_FR["rich_text"]))
        home = sb.find_story("home")
        sb.api("PUT", f"/stories/{home['id']}", body={"story": {"name": "Home", "content": c}, "publish": 1})

        for key, name, slug, fr_key in (("faq", "FAQ", "faq", "/faq"), ("guides", "Buying guides", "guides", "/guides")):
            t_fr, d_fr = PAGES_FR[fr_key]
            c = {"component": "page", "hero": page_hero(key)}
            tr(c, "title", name, t_fr)
            tr(c, "description", heroes[key][1], d_fr)
            if key == "faq":
                sb.upsert_story("faq", name, c)
            else:
                sb.upsert_startpage(folders["guides"], name, c)
            print(f"  page: /{slug}")


if __name__ == "__main__":
    main()
