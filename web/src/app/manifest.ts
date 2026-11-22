import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pullhaus",
    short_name: "Pullhaus",
    description: "A sealed-card atelier on BNB Chain. Burn $PULL to pull.",
    start_url: "/",
    display: "standalone",
    background_color: "#070605",
    theme_color: "#070605",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
