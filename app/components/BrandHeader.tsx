"use client";

import Link from "./AppLink";
import { usePathname } from "next/navigation";

import { experienceHome } from "../../lib/app-experience";
import { useAppExperience } from "./AppExperience";

export default function BrandHeader() {
  const pathname = usePathname();
  const experience = useAppExperience();
  if (pathname === "/") return null;
  return (
    <header className="brandBar">
      <Link href={experience ? experienceHome(experience) : "/"} className="brandBarLogo" aria-label="RoadLink, inicio">
        <svg viewBox="0 0 36 40" fill="none" aria-hidden="true"><path d="M5 8h15c7 0 9 3 9 7s-3 7-9 7H6m0-7h14m-6 7 15 12M6 22v12" stroke="currentColor" strokeWidth="3" /></svg>
        <span>Road<b>Link</b>{experience && <small style={{display:"block",fontSize:10,letterSpacing:2,color:"#d9c39d",marginTop:4}}>{experience === "driver" ? "CONDUCTOR" : "PASAJERO"}</small>}</span>
      </Link>
      <nav aria-label="Navegación de RoadLink">
        {experience === "driver" ? <><Link href="/my-rides">Mis viajes</Link><Link href="/wallet">Cartera</Link></> : experience === "passenger" ? <><Link href="/find-ride">Buscar viaje</Link><Link href="/my-bookings">Mis reservas</Link></> : <><Link href="/pasajero">Pasajero</Link><Link href="/conductor">Conductor</Link></>}
        <Link href="/profile">Mi cuenta ↗</Link>
      </nav>
    </header>
  );
}
