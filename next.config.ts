import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a small self-contained server in .next/standalone for the Docker image
  output: "standalone",
  serverExternalPackages: ["exceljs", "googleapis"],
  poweredByHeader: false,
};

export default nextConfig;
