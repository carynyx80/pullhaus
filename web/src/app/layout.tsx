import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Providers } from "@/components/providers";
import "./globals.css";

// Latin woff2 files live in src/fonts. The build does not call Google Fonts.
const display = localFont({
  src: [
    { path: "../fonts/BigShoulders-500.woff2", weight: "500", style: "normal" },
    { path: "../fonts/BigShoulders-700.woff2", weight: "700", style: "normal" },
    { path: "../fonts/BigShoulders-800.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-display-face",
  display: "swap",
});
const serif = localFont({
  src: [
    { path: "../fonts/Fraunces-500.woff2", weight: "500", style: "normal" },
    { path: "../fonts/Fraunces-500-italic.woff2", weight: "500", style: "italic" },
    { path: "../fonts/Fraunces-600.woff2", weight: "600", style: "normal" },
    { path: "../fonts/Fraunces-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-serif-face",
  display: "swap",
});
const sans = localFont({
  src: [
    { path: "../fonts/Outfit-400.woff2", weight: "400", style: "normal" },
    { path: "../fonts/Outfit-500.woff2", weight: "500", style: "normal" },
    { path: "../fonts/Outfit-600.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-sans-face",
  display: "swap",
});
const mono = localFont({
  src: [
    { path: "../fonts/JetBrainsMono-400.woff2", weight: "400", style: "normal" },
    { path: "../fonts/JetBrainsMono-500.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-mono-face",
  display: "swap",
});

const description = "A sealed-card atelier on BNB Chain. Burn $PULL to pull. Points are perks.";

function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://127.0.0.1:4180";
}

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "Pullhaus", template: "%s · Pullhaus" },
  description,
  applicationName: "Pullhaus",
  openGraph: {
    title: "Pullhaus",
    description: "Burn. Pull. Reveal. A sealed-card atelier on BNB Chain.",
    siteName: "Pullhaus",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pullhaus",
    description: "Burn. Pull. Reveal. A sealed-card atelier on BNB Chain.",
  },
};

export const viewport: Viewport = {
  themeColor: "#070605",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
