import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // For Cloudflare Pages - no output mode needed
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  images: {
    unoptimized: true, // Required for Cloudflare Pages
  },
};

export default nextConfig;
