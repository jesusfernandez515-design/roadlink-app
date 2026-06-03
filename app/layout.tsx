import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "RoadLink - Long Distance Ride Sharing",
  description:
    "RoadLink helps drivers and passengers connect for safe, affordable long distance rides across the United States.",
  keywords: [
    "RoadLink",
    "ride sharing",
    "long distance rides",
    "drivers",
    "passengers",
    "road trips",
    "travel",
  ],
  authors: [{ name: "RoadLink" }],
  openGraph: {
    title: "RoadLink - Long Distance Ride Sharing",
    description:
      "Find drivers and passengers for safe, affordable long distance rides.",
    url: "https://www.getroadlink.com",
    siteName: "RoadLink",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
