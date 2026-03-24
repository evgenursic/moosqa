import type { Metadata } from "next";
import { Cormorant_Garamond, Space_Mono } from "next/font/google";
import { getSiteUrl } from "@/lib/site";
import "./globals.css";

const mono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "MooSQA | Music Radar",
    template: "%s | MooSQA",
  },
  description:
    "Editorial music radar for fresh indie releases, pulled automatically from r/indieheads and shaped for fast listening discovery.",
  applicationName: "MooSQA",
  alternates: {
    canonical: "/",
  },
  keywords: [
    "new music",
    "indie releases",
    "new albums",
    "new EPs",
    "live sessions",
    "r/indieheads",
    "music discovery",
  ],
  openGraph: {
    title: "MooSQA | Music Radar",
    description:
      "Editorial music radar for fresh indie releases, albums, EPs and live sessions surfaced from r/indieheads.",
    url: "/",
    siteName: "MooSQA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MooSQA | Music Radar",
    description:
      "Fresh indie releases, albums, EPs and live sessions in one fast editorial feed.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${mono.variable} ${cormorant.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
