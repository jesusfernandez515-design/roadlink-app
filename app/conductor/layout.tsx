import type { Metadata } from "next";
export const metadata: Metadata = { manifest: "/manifest-driver.json", title: "RoadLink Conductor", appleWebApp: { capable: true, title: "RoadLink Conductor", statusBarStyle: "black" } };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
