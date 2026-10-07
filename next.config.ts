import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Storyblok asset delivery
      { protocol: "https", hostname: "a.storyblok.com" },
      // BigCommerce product images
      { protocol: "https", hostname: "cdn11.bigcommerce.com" },
    ],
  },
};

export default nextConfig;
