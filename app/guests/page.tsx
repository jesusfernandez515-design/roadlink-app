import Link from "../components/AppLink";
import styles from "../ride-now/ride-now.module.css";

export default function GuestsPage() {
  return <main className={styles.page}>
    <header className={styles.hero}><Link href="/dashboard">← Mi panel</Link><p className={styles.eyebrow}>ROADLINK · INVITADOS</p><h1>Tú reservas. Tu invitado viaja.</h1>
      <p>Pide un viaje para tu mamá, un familiar o alguien a quien quieras acompañar desde tu cuenta.</p></header>
    <section className={styles.card}><h2>¿Cuándo necesita salir?</h2>
      <nav className={styles.links}><Link href="/ride-now?guest=1">Necesita salir ahora →</Link><Link href="/find-ride?guest=1">Buscar un viaje programado →</Link></nav>
    </section>
    <section className={styles.card}><h2>Todo queda en tu cuenta</h2><ol>
      <li>Indica el nombre, teléfono y las instrucciones para recoger al invitado, con su permiso.</li>
      <li>Reserva y realiza el pago de prueba desde tu cuenta.</li>
      <li>Coordina con el conductor por mensajes. El conductor verá quién viajará en tu lugar.</li>
    </ol><p>Tu invitado no necesita registrarse. Esta versión no envía mensajes SMS ni enlaces de seguimiento al invitado. Los pagos reales permanecen desactivados.</p>
    <Link href="/my-bookings">Consultar mis reservas</Link></section>
  </main>;
}
