/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/day03-ai-builder.html",
        destination: "/foundry/day03",
      },
    ];
  },
};

export default nextConfig;
