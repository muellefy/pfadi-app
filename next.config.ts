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
        // shortcut: no script-src (Next's inline scripts would need nonces), add one if XSS ever becomes a concern
        { key: "Content-Security-Policy", value: "frame-ancestors 'self'; base-uri 'self'; form-action 'self' https://accounts.google.com; object-src 'none'" },
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
