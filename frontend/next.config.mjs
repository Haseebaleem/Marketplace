/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@marketplace/shared"],
  images: {
    // Backend serves /uploads/* on port 4000 in dev. next/image without
    // `unoptimized` validates remote URLs against these patterns; with
    // `unoptimized` it falls back to a plain <img>, but listing the host
    // here lets us drop `unoptimized` later without code changes.
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "4000",
        pathname: "/uploads/**",
      },
    ],
  },
};

export default nextConfig;
