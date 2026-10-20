import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "*.app.github.dev",
    "*.github.dev",
    "*.preview.app.github.dev",
    "*.e2b.app",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "sxvmsabhwvbwiorlufrm.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
