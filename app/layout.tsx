import type { Metadata } from "next";
import "./globals.css";
const origin = "https://blockmillion.pages.dev";
export const metadata: Metadata = {
  metadataBase: new URL(origin),
  title: "1 Million Bitcoin Blocks — Live Countdown | BLOCK MILLION",
  description:
    "The live countdown to Bitcoin block 1,000,000. Watch new blocks land, track the blocks and estimated time remaining, and explore Bitcoin’s early block milestones.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "1 Million Bitcoin Blocks — Live Countdown | BLOCK MILLION",
    description:
      "Time and blocks remaining until Bitcoin block 1,000,000, with historical milestones and an interactive issuance curve.",
    type: "website",
    url: origin,
    siteName: "BLOCK MILLION",
  },
  twitter: {
    card: "summary",
    title: "BLOCK MILLION — Bitcoin Block 1,000,000",
    description: "Track time and blocks remaining until Bitcoin block 1,000,000.",
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
