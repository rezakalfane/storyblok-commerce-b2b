import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Only Storyblok's Visual Editor may embed the site in a frame.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'self' https://app.storyblok.com https://*.storyblok.com" },
        ],
      },
    ];
  },
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
