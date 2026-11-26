import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a small self-contained server in .next/standalone for the Docker image
  output: "standalone",
  serverExternalPackages: ["exceljs", "@googleapis/drive"],
  poweredByHeader: false,
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        // the Content-Security-Policy needs a fresh nonce per request, so proxy.ts sets it
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        // ignored by browsers over plain http, so safe for local setups
        { key: "Strict-Transport-Security", value: "max-age=31536000" },
      ],
    }];
  },
};

export default nextConfig;
