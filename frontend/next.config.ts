import type { NextConfig } from "next";

// Backend base URL — override with BACKEND_URL in the environment for
// staging/production. Defaults to the local FastAPI dev server.
const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*`,
      },
      // Backend top-level routes the app reads directly.
      {
        source: "/intakes",
        destination: `${BACKEND_URL}/intakes`,
      },
      {
        source: "/intakes/:path*",
        destination: `${BACKEND_URL}/intakes/:path*`,
      },
      {
        source: "/memory/:path*",
        destination: `${BACKEND_URL}/memory/:path*`,
      },
      {
        source: "/health",
        destination: `${BACKEND_URL}/health`,
      },
    ];
  },
};

export default nextConfig;
