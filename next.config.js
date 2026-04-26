/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    outputFileTracingIncludes: {
      "/api/*": ["./node_modules/puppeteer-extra-plugin-stealth/evasions/**/*"],
    },
  },
  async rewrites() {
    return [
      {
        source: "/get",
        destination: "/api/get",
      },
      {
        source: "/v2/get",
        destination: "/api/v2/get",
      },
    ];
  },
};

module.exports = nextConfig;
