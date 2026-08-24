import type { Metadata } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

// Body: Inter — geometric-humanist, warm, not a "crypto" font.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Display / wordmark: Space Grotesk — geometric grotesk with a humanist edge.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

// Numbers: JetBrains Mono — stakes, countdowns, thresholds get their own
// ticker-like identity. The emotional core of the product is numeric.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://bondline.app"),
  title: "Bondline — ship together, or fund together",
  description:
    "A group commitment protocol on Celo. Stake CELO against your own deadline. Beat the Line and your Circle cosigns the refund; cross it and your stake drops into the shared Pot.",
  icons: { icon: "/logo.svg" },
  openGraph: {
    title: "Bondline - ship together, or fund the group chat",
    description:
      "Put your money where your deadline is. Form a Circle, stake against your own deadline, and let your crew cosign the outcome on-chain.",
    type: "website",
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
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
