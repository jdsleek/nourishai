/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return {
      beforeFiles: [
        /** Site index: Day 03 deck (URL stays `/`) */
        { source: "/", destination: "/foundry/day03" },
        { source: "/day03-ai-builder.html", destination: "/foundry/day03" },
      ],
    };
  },
  async redirects() {
    return [
      /** Former public registry — instructor-only in /foundry/admin */
      {
        source: "/qaf-product-ideation-registry.html",
        destination: "/foundry/admin",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
