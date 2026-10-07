import type { ContentProvider } from "@/core/content";
import { isPreviewRequest } from "@/lib/request";
import * as s from "./mapper";

/** Storyblok: published stories with the public token; drafts with the preview token when the proxy verified the editor's signature. */
export const provider: ContentProvider = {
  id: "storyblok",
  getPage: async (key, locale) => s.getPage(key, locale, await isPreviewRequest()),
  getNavigation: async (locale) => s.getNavigation(locale, await isPreviewRequest()),
  getAnnouncement: async (locale, audience) => s.getAnnouncement(locale, await isPreviewRequest(), audience),
  getPosts: async (locale) => s.getPosts(locale, await isPreviewRequest()),
  getPost: async (slug, locale) => s.getPost(slug, locale, await isPreviewRequest()),
  getGuides: async (locale) => s.getGuides(locale, await isPreviewRequest()),
  getGuide: async (slug, locale) => s.getGuide(slug, locale, await isPreviewRequest()),
  getSpotlights: async (locale) => s.getSpotlights(locale, await isPreviewRequest()),
};
