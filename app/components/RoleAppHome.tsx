"use client";

import Link from "./AppLink";
import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { ArrowUpRight, CarFront, MapPin, UsersRound, Wallet, Ticket, MessageCircle, Bell, UserRound } from "lucide-react";
import { auth } from "../../lib/firebase";
import type { AppExperience } from "../../lib/app-experience";
import ProfileIdentity from "./ProfileIdentity";
import styles from "./role-app.module.css";

export default function RoleAppHome({ mode }: { mode: AppExperience }) {
  const driver = mode === "driver";
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => onAuthStateChanged(auth, current => { setUser(current); setReady(true); }), []);
  const cards = driver ? [
    { href: "/ride-now", label: "Recogidas para ahora", text: "Atiende solicitudes de último minuto.", icon: CarFront },
    { href: "/my-rides", label: "Mis viajes", text: "Tus rutas publicadas y su estado.", icon: CarFront },
    { href: "/ride-passengers", label: "Mis pasajeros", text: "Confirma reservas y finaliza cada viaje.", icon: UsersRound },
    { href: "/wallet", label: "Mi cartera", text: "Pagos, ganancias y transferencias.", icon: Wallet },
  ] : [
    { href: "/guests", label: "Viajes para invitados", text: "Reserva y paga por otra persona desde tu cuenta.", icon: UsersRound },
    { href: "/ride-now", label: "Viajar ahora", text: "Solicita una recogida para ti o para un invitado.", icon: CarFront },
    { href: "/find-ride", label: "Buscar un viaje", text: "Encuentra personas que van hacia tu destino.", icon: MapPin },
    { href: "/my-bookings", label: "Mis reservas", text: "Consulta tu asiento, pago y recorrido.", icon: Ticket },
    { href: "/messages", label: "Mis mensajes", text: "Coordina los detalles con tu conductor.", icon: MessageCircle },
  ];
  return <main className={styles.page}>
    <section className={styles.hero}>
      <p className={styles.eyebrow}>ROADLINK · {driver ? "CONDUCTOR" : "PASAJERO"}</p>
      <h1>{driver ? <>Tu ruta.<br /><em>Nuevas conexiones.</em></> : <>Tu destino.<br /><em>Más cerca.</em></>}</h1>
      <p className={styles.intro}>{driver ? "Comparte el camino. Gestiona tus viajes, acompaña a tus pasajeros y lleva el control de tus ganancias." : "Viaja con personas que van en tu misma dirección. Busca tu ruta, reserva tu asiento y disfruta el camino."}</p>
      {ready && user ? <div className={styles.identity}><ProfileIdentity photoURL={user.photoURL || ""} uid={user.uid} name={user.displayName || "Mi cuenta"} role={driver ? "Conductor" : "Pasajero"} size={48} /></div> : <p role="status">{ready ? "Entra con tu cuenta RoadLink para comenzar." : "Cargando tu cuenta…"}</p>}
      <Link className={styles.primary} href={ready && !user ? "/login" : driver ? "/offer-ride" : "/find-ride"}>{ready && !user ? "Entrar en mi cuenta" : driver ? "Publicar un viaje" : "Encontrar mi viaje"}<ArrowUpRight size={20} /></Link>
    </section>
    <section className={styles.grid} aria-label={driver ? "Herramientas del conductor" : "Herramientas del pasajero"}>
      {cards.map(card => <Link className={styles.card} href={card.href} key={card.label}><card.icon size={26} strokeWidth={1.4} aria-hidden="true" /><h2>{card.label}</h2><p>{card.text}</p><ArrowUpRight size={18} aria-hidden="true" /></Link>)}
    </section>
    <nav className={styles.quick} aria-label="Tu cuenta RoadLink"><Link href="/messages"><MessageCircle size={18} />Mensajes</Link><Link href="/notifications"><Bell size={18} />Notificaciones</Link><Link href="/security">Seguridad · 2 pasos</Link><Link href="/profile"><UserRound size={18} />Mi perfil</Link></nav>
    <section className={styles.switcher}><p>Una comunidad. Dos formas de compartir el camino.</p><Link href={driver ? "/pasajero" : "/conductor"}>Abrir RoadLink {driver ? "Pasajero" : "Conductor"} <ArrowUpRight size={16} /></Link></section>
  </main>;
}
