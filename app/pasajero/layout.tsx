import type { Metadata } from "next";
export const metadata: Metadata = { manifest: "/manifest-passenger.json", icons: { icon: [{ url: "/icons/roadlink-passenger-v1.svg", type: "image/svg+xml" }, { url: "/icons/roadlink-passenger-v1-32.png", sizes: "32x32", type: "image/png" }], apple: { url: "/icons/roadlink-passenger-v1-180.png", sizes: "180x180", type: "image/png" } }, title: "RoadLink Pasajero", appleWebApp: { capable: true, title: "RoadLink Pasajero", statusBarStyle: "black" } };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
