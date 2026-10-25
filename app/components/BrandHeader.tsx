"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function BrandHeader() {
  const pathname = usePathname();
  if (pathname === "/") return null;
  return (
    <header className="brandBar">
      <Link href="/" className="brandBarLogo" aria-label="RoadLink, inicio">
        <svg viewBox="0 0 36 40" fill="none" aria-hidden="true"><path d="M5 8h15c7 0 9 3 9 7s-3 7-9 7H6m0-7h14m-6 7 15 12M6 22v12" stroke="currentColor" strokeWidth="3" /></svg>
        <span>Road<b>Link</b></span>
      </Link>
      <nav aria-label="Navegación de RoadLink">
        <Link href="/find-ride">Buscar viaje</Link>
        <Link href="/offer-ride">Ofrecer viaje</Link>
        <Link href="/profile">Mi cuenta ↗</Link>
      </nav>
    </header>
  );
}
