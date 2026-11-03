import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    // tệp backlog.json upload qua server action (Vercel giới hạn body 4.5 MB)
    serverActions: { bodySizeLimit: "4mb" },
  },
  async redirects() {
    return [{ source: "/", destination: "/board", permanent: false }];
  },
};

export default nextConfig;
