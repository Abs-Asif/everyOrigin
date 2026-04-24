/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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

module.exports = nextConfig
