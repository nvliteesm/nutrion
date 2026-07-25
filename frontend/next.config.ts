import type { NextConfig } from "next";

// In local dev, BACKEND_URL proxies API calls to the FastAPI server.
// Falls back to NEXT_PUBLIC_BACKEND_URL (same value used by the browser for long AI calls).
// On Vercel, vercel.json routes handle this — no rewrites needed.
const BACKEND_URL =
  process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;

const nextConfig: NextConfig = {
  ...(BACKEND_URL
    ? {
        async rewrites() {
          return [
            { source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` },
            { source: "/intakes", destination: `${BACKEND_URL}/intakes` },
            { source: "/intakes/:path*", destination: `${BACKEND_URL}/intakes/:path*` },
            { source: "/memory/:path*", destination: `${BACKEND_URL}/memory/:path*` },
            { source: "/totals/:path*", destination: `${BACKEND_URL}/totals/:path*` },
            { source: "/chat", destination: `${BACKEND_URL}/chat` },
            { source: "/health", destination: `${BACKEND_URL}/health` },
            { source: "/uploads/:path*", destination: `${BACKEND_URL}/uploads/:path*` },
          ];
        },
      }
    : {}),
};

export default nextConfig;
