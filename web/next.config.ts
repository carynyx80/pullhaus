import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@pullhaus/shared"],
  images: { unoptimized: true },
};

export default nextConfig;
