import type { Metadata, Viewport } from "next";
// self-hosted via npm, so builds never fetch fonts from the internet
import "@fontsource/barlow-condensed/latin-600.css";
import "@fontsource/barlow-condensed/latin-700.css";
import "@fontsource-variable/source-sans-3/wght.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Lagerplaner", template: "%s · Lagerplaner" },
  description: "Lagerplanung mit eCamp und Google Drive",
  robots: { index: false, follow: false },
};

// cover: lets the bottom tab bar sit above the iPhone home indicator (safe-area insets)
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: [
  { media: "(prefers-color-scheme: light)", color: "#f4f6f1" },
  { media: "(prefers-color-scheme: dark)", color: "#0f1a16" },
] };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de-CH">
      <body>{children}</body>
    </html>
  );
}
