import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    disableStaticImages: true,
  },
  webpack(config) {
    // Only rewrite Josh's Vite-era assets. A global PNG rule also swallows
    // app/icon.png and Next's metadata image pipeline, which then streams a
    // thrown error into the client as `$Z` and blanks the site.
    config.module.rules.push({
      test: /\.(png|jpe?g|gif|webp|otf|woff2?)$/i,
      include: path.join(root, "web"),
      type: "asset/resource",
    });
    return config;
  },
  async headers() {
    return [
      {
        source: "/api/pipeline",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-transform" },
          { key: "X-Accel-Buffering", value: "no" },
        ],
      },
      {
        source: "/api/inbound",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-transform" },
          { key: "X-Accel-Buffering", value: "no" },
        ],
      },
    ];
  },
};

export default nextConfig;
