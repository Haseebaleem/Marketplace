/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@marketplace/shared"],
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost" },
    ],
  },
};

export default nextConfig;
