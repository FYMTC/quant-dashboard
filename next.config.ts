import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "172.17.0.3",
    "127.0.0.1",
    "localhost",
  ],
};

export default nextConfig;
