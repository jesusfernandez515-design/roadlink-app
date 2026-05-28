import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
});

export const metadata: Metadata = {
  title: "Roadlink - Share Your Journey",
  description:
    "Connect with travelers going your way. Save money, reduce emissions, and make new friends on the road.",
  keywords: [
    "carpooling",
    "ride sharing",
    "travel",
    "commute",
    "eco-friendly",
    "road trip",
  ],
  authors: [{ name: "Roadlink" }],
  openGraph: {
    title: "Roadlink - Share Your Journey",
    description:
      "Connect with travelers going your way. Save money, reduce emissions, and make new friends on the road.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0891b2",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} bg-[var(--background)]`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
