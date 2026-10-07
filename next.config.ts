import type { NextConfig } from "next";

// In development, local tooling on localhost may frame the site too (the editor itself is always https://app.storyblok.com).
const FRAME_ANCESTORS = `'self' https://app.storyblok.com https://*.storyblok.com${process.env.NODE_ENV === "production" ? "" : " http://localhost:* https://localhost:*"}`;

const nextConfig: NextConfig = {
  // Only Storyblok's Visual Editor may embed the site in a frame.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: `frame-ancestors ${FRAME_ANCESTORS}` },
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
