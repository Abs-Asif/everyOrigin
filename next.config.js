/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/get",
        destination: "/api/get",
      },
    ];
  },
};

module.exports = nextConfig
