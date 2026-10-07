#!/usr/bin/env python3
"""Add the block-composed model on top of the existing Storyblok content (idempotent, additive: the old fields stay filled).

Creates the `pages` folder with the stories home, faq, guides and blog (type `page`, an ordered list of inline blocks in
`components`, mirroring the Amplience pages) and gives every blog post a `content` block list (a text block with the article) and a
`read_time`. Run schemas.py and seed.py first.
Usage: python3 tools/storyblok/blocks.py
"""
import os
import sys
import textwrap
import uuid

sys.path.insert(0, os.path.dirname(__file__))
import photos  # noqa: E402
import sb  # noqa: E402
from content import AUTHORS, POSTS  # noqa: E402
from content_extra import FAQS, GUIDES, HOME, SPOTLIGHTS  # noqa: E402
from content_fr import BLOG_LISTING_FR, HEROES_FR, HOME_FR, PAGES_FR, THEME_KEYWORDS_FR  # noqa: E402,F401
from content_fr_posts import POSTS_FR  # noqa: E402

IMG = sb.IMG_DIR
slugify, richtext = sb.slugify, sb.richtext


def blok(component, **fields):
    return {"_uid": str(uuid.uuid4()), "component": component, **fields}


def tr(content, key, en, fr):
    """A translatable field: the default (English) value plus its French `__i18n__fr` sibling."""
    content[key] = en
    content[f"{key}__i18n__fr"] = fr


def uuids(folder):
    """slug -> uuid of the stories in a folder."""
    out = {}
    page = 1
    while True:
        batch = sb.api("GET", "/stories", params={"starts_with": f"{folder}/", "per_page": 100, "page": page, "is_folder": 0}).get("stories", [])
        out.update({s["full_slug"]: s["uuid"] for s in batch})
        if len(batch) < 100:
            return out
        page += 1


FLAT = [(ai, pi, p) for ai, posts in enumerate(POSTS) for pi, p in enumerate(posts)]
FLAT_FR = [p for posts in POSTS_FR for p in posts]


def post_blocks():
    """Gives existing posts a `content` block list (the article as a text block) and a `read_time` (an upgrade of older stories)."""
    flat, flat_fr = FLAT, FLAT_FR
    print("== post content blocks")
    post_ids = {}
    for ((ai, pi, (title, intro, s1, s2, takeaways)), fr) in zip(flat, flat_fr):
        slug = slugify(title)
        t_fr, intro_fr, s1_fr, s2_fr, take_fr = fr
        existing = sb.find_story(f"blog/{slug}")
        if not existing:
            sys.exit(f"missing story blog/{slug}: run seed.py first")
        post_ids[slug] = existing["uuid"]
        story = sb.api("GET", f"/stories/{existing['id']}")["story"]
        c = story["content"]
        text = blok("text_block")
        tr(text, "text",
           richtext([("p", intro), ("h2", s1[0]), ("p", s1[1]), ("h2", s2[0]), ("p", s2[1]), ("h2", "Key takeaways"), ("ul", takeaways)]),
           richtext([("p", intro_fr), ("h2", s1_fr[0]), ("p", s1_fr[1]), ("h2", s2_fr[0]), ("p", s2_fr[1]), ("h2", "À retenir"), ("ul", take_fr)]))
        # keep the block's uid stable across runs so editors' references and bridge ids do not churn
        old = (c.get("content") or [{}])[0] if c.get("content") else {}
        if old.get("_uid"):
            text["_uid"] = old["_uid"]
        words = len(intro.split()) + len(s1[1].split()) + len(s2[1].split())
        c["content"] = [text]
        c["read_time"] = str(max(3, round(words * 3 / 200)))
        sb.api("PUT", f"/stories/{existing['id']}", body={"story": {"content": c}, "publish": 1})
    print(f"  {len(post_ids)} posts")


def build_pages():
    """The `pages` folder: home, faq, guides and blog stories made of inline blocks, pointing at the existing guides, FAQs, spotlights and posts."""
    os.makedirs(IMG, exist_ok=True)
    flat = FLAT
    blog = uuids("blog")
    post_ids = {slugify(t): blog[f"blog/{slugify(t)}"] for _ai, _pi, (t, *_r) in flat}

    # ---- the stories the collections point at
    faq = uuids("faqs")
    guide = uuids("guides")
    spot = uuids("spotlights")
    faq_ids = [faq[f"faqs/{slugify(q)[:60]}"] for (_t, q, _p, _f) in FAQS]
    guide_ids = [guide[f"guides/{slugify(g['title'])}"] for g in GUIDES]
    spot_feat = [spot[f"spotlights/{slugify(sp[1])[:60]}"] for sp in SPOTLIGHTS if sp[7]][:3]
    latest = [list(post_ids.values())[i] for i in sorted(range(len(flat)), key=lambda i: -(flat[i][1] * 6 + flat[i][0]))[:3]]

    # ---- heroes
    print("== pages")
    photo = {"home": ("mea_voiture", (780, 1040), "hero-home-photo.jpg"), "faq": ("alim", (1200, 900), "hero-faq-photo.jpg"),
             "guides": ("mea_pile", (1200, 900), "hero-guides-photo.jpg"), "blog": ("bat_moto", (1200, 900), "blog-hero-photo.jpg")}
    heroes = {
        "home": ("Commerce B2B", HOME["description"], "Browse buying guides", "/guides"),
        "faq": ("Frequently asked questions", "Quick answers for trade buyers on ordering, pricing and credit, delivery, accounts and fitment.", "Browse buying guides", "/guides"),
        "guides": ("Buying guides", "Practical, step-by-step checklists for matching the right battery to the job, for workshops, fleets and leisure buyers.", "Read the FAQ", "/faq"),
        "blog": ("The B2B Commerce Blog", "Practical guidance on pricing, ordering, integrations, payments, sales and headless storefronts for B2B commerce teams.", "Browse articles", "/blog"),
    }

    def hero(key):
        t, d, cta, href = heroes[key]
        tf, df, cf_, _ = HEROES_FR[key]
        name, size, file = photo[key]
        b = blok("hero_banner", image=sb.upload_asset(photos.crop(name, size, 0, os.path.join(IMG, file)), t), cta_href=href, full_width=True,
                 variant="home" if key == "home" else "default")
        if key == "home":
            b["second_image"] = sb.upload_asset(photos.crop("mea_moto", (780, 1040), 0, os.path.join(IMG, "home-second-photo.jpg")), t)
        tr(b, "title", t, tf)
        tr(b, "description", d, df)
        tr(b, "cta_label", cta, cf_)
        return b

    def collection(kind, items=(), **texts):
        b = blok("collection_block", kind=kind, items=list(items))
        for k, (en, fr_) in texts.items():
            tr(b, k, en, fr_)
        return b

    folder = sb.ensure_folder("pages", "Pages", "page")

    features = []
    for i, ((t, copy, layout, _), (t_fr, copy_fr)) in enumerate(zip(HOME["blocks"], HOME_FR["blocks"])):
        p = os.path.join(IMG, f"home-block-photo-{i}.jpg")
        photos.crop(["mea_chargeur", "mea_outillage", "mea_solaire"][i], (1200, 800), 0, p)
        b = blok("feature_block", image=sb.upload_asset(p, t), layout=layout)
        tr(b, "title", t, t_fr)
        tr(b, "copy", sb.html_paragraphs(copy), sb.html_paragraphs(copy_fr))
        features.append(b)
    intro = blok("text_block")
    tr(intro, "text", sb.html_paragraphs(HOME["rich_text"]), sb.html_paragraphs(HOME_FR["rich_text"]))

    def page(key, name, title, title_fr, desc, desc_fr, components):
        c = {"component": "page", "components": components}
        tr(c, "title", title, title_fr)
        tr(c, "description", desc, desc_fr)
        sb.upsert_story(f"pages/{key}", name, c, folder["id"])
        print(f"  pages/{key}: {len(components)} components")

    page("home", "Home", HOME["title"], HOME["title"], HOME["description"], HOME_FR["description"],
         [hero("home"), intro, collection("categories", title=("Shop by category", "Acheter par catégorie")), *features,
          collection("spotlights", spot_feat, title=("Trade favourites", "Les favoris des pros")),
          collection("guides", guide_ids[:3], title=("From the buying guides", "Dans les guides d'achat"), link_label=("Buying guides", "Guides d'achat"))])
    t_fr, d_fr = PAGES_FR["/faq"]
    page("faq", "FAQ", "FAQ", t_fr, heroes["faq"][1], d_fr, [hero("faq"), collection("faqs", faq_ids)])
    t_fr, d_fr = PAGES_FR["/guides"]
    page("guides", "Buying guides", "Buying Guides", t_fr, heroes["guides"][1], d_fr,
         [hero("guides"), collection("guideListing", title=("Buying guides", "Guides d'achat"))])
    L = BLOG_LISTING_FR
    page("blog", "Blog", "Blog", "Blog", heroes["blog"][1], HEROES_FR["blog"][1],
         [hero("blog"), collection("posts", latest, title=("Latest articles", L["from_blog_title"])),
          collection("postListing", title=("All articles", "Tous les articles"),
                     search_placeholder=("Search articles", L["placeholder"]), search_button_label=("Search", L["search_button"]))])


def main():
    os.makedirs(IMG, exist_ok=True)
    post_blocks()
    build_pages()


if __name__ == "__main__":
    main()
