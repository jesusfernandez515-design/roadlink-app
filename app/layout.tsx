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
  title: "Roadlink - Comparte tu viaje",
  description:
    "Conecta con viajeros que van en tu misma dirección. Ahorra dinero, reduce emisiones y haz nuevos amigos en el camino.",
  keywords: [
    "carpooling",
    "compartir viajes",
    "viajes compartidos",
    "transporte",
    "ecológico",
    "road trip",
  ],
  authors: [{ name: "Roadlink" }],
  openGraph: {
    title: "Roadlink - Comparte tu viaje",
    description:
      "Conecta con viajeros que van en tu misma dirección. Ahorra dinero, reduce emisiones y haz nuevos amigos en el camino.",
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
    <html lang="es" className={`${inter.variable} ${spaceGrotesk.variable} bg-[var(--background)]`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
