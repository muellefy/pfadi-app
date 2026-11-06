import type { Metadata } from "next";
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de-CH">
      <body>{children}</body>
    </html>
  );
}
