import type { Metadata, Viewport } from "next";
import { Big_Shoulders, Fraunces, JetBrains_Mono, Outfit } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const display = Big_Shoulders({
  subsets: ["latin"],
  variable: "--font-display-face",
  weight: ["500", "700", "800"],
  display: "swap",
  adjustFontFallback: false,
});
const serif = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif-face",
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});
const sans = Outfit({
  subsets: ["latin"],
  variable: "--font-sans-face",
  weight: ["400", "500", "600"],
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-face",
  weight: ["400", "500"],
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
