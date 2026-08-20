/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    disableStaticImages: true,
  },
  webpack(config) {
    config.module.rules.push({
      test: /\.(png|jpe?g|gif|webp|otf|woff2?)$/i,
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
