import type { NextConfig } from "next"

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000"

const nextConfig: NextConfig = {
  // Dev server only: allow opening the app via 127.0.0.1 as well as localhost.
  allowedDevOrigins: ["127.0.0.1"],
  // Proxy the API through this origin so auth cookies stay first-party.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` }]
  },
}

export default nextConfig
