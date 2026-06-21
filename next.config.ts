import type { NextConfig } from "next";

const blogDomain = process.env.BLOG_DOMAIN;
const frameAncestors = blogDomain
  ? `'self' ${blogDomain}`
  : `'self'`;

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `frame-ancestors ${frameAncestors};`,
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
