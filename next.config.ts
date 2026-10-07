import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Only Contentstack's editor (Live Preview / Visual Editor) may embed the site in a frame.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' https://*.contentstack.com https://*.contentstack.io",
          },
          // Which Contentstack environment this deployment reads (not a secret). Handy to confirm a switch.
          { key: "X-Content-Environment", value: process.env.CONTENTSTACK_ENVIRONMENT ?? "unset" },
        ],
      },
    ];
  },
  images: {
    // Contentstack asset/image delivery hosts (all regions)
    remotePatterns: [
      { protocol: "https", hostname: "*-assets.contentstack.com" },
      { protocol: "https", hostname: "assets.contentstack.io" },
      { protocol: "https", hostname: "*-images.contentstack.com" },
      { protocol: "https", hostname: "images.contentstack.io" },
      // BigCommerce product images
      { protocol: "https", hostname: "cdn11.bigcommerce.com" },
    ],
  },
};

export default nextConfig;
