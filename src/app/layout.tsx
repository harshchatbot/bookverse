import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "BookVerse — Buy & Sell Educational Books Across India",
  description: "India's marketplace for educational books.",
  applicationName: "BookVerse",
  authors: [{ name: "BookVerse" }],
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon.png", type: "image/png" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/apple-touch-icon.png" },
      { url: "/icon-192x192.png", sizes: "192x192" },
      { url: "/icon-512x512.png", sizes: "512x512" },
    ],
  },
  openGraph: {
    title: "BookVerse — Educational Books Marketplace",
    description: "Buy and sell educational books across India.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "BookVerse — Educational Books Marketplace",
    description: "Buy and sell educational books across India.",
  },
};

export const viewport: Viewport = {
  themeColor: "#7C9A6D",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
