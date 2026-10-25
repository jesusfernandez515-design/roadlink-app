import type { Metadata } from "next";
export const metadata: Metadata = { title: "RoadLink Pasajero", manifest: "/manifest-passenger.json", appleWebApp: { capable: true, title: "RoadLink Pasajero", statusBarStyle: "black" } };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
