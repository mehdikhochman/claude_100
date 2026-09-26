import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // sharp and pg are native/Node-only; keep them out of the bundler.
  serverExternalPackages: ["sharp", "pg"],
  // A few sensible security headers. CSP is intentionally left out to keep
  // the app simple; Next's defaults plus these cover the common cases.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
