import type { Metadata, Viewport } from "next";
import BottomNavigation from "./components/BottomNavigation";

export const metadata: Metadata = {
  title: "RoadLink",
  description:
    "RoadLink helps drivers and passengers connect for safe, affordable long distance rides.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "RoadLink",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/roadlink-logo.png",
    apple: "/roadlink-logo.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#22c55e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <BottomNavigation />
      </body>
    </html>
  );
}
