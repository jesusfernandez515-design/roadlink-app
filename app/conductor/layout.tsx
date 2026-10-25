import type { Metadata } from "next";
export const metadata: Metadata = { title: "RoadLink Conductor", manifest: "/manifest-driver.json", appleWebApp: { capable: true, title: "RoadLink Conductor", statusBarStyle: "black" } };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
