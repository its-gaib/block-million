import type { Metadata } from "next";
import "./globals.css";
const origin = "https://height-million.frosty-okapi-1278.chatgpt.site";
export const metadata: Metadata = {
  metadataBase: new URL(origin),
  title: "Bitcoin Block 1,000,000 Countdown | HEIGHT MILLION",
  description:
    "The live countdown to Bitcoin block 1,000,000. Watch new blocks land, track the blocks and estimated time remaining, and find your million-block party.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "HEIGHT MILLION — One chain. One million blocks.",
    description:
      "The live Bitcoin block 1,000,000 countdown. Every block brings us closer.",
    type: "website",
    url: origin,
    siteName: "HEIGHT MILLION",
  },
  twitter: {
    card: "summary",
    title: "HEIGHT MILLION — Bitcoin Block 1,000,000",
    description: "Every block brings us closer. Join the countdown.",
  },
  robots: { index: true, follow: true },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
