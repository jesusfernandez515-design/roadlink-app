"use client";

import Link from "./AppLink";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../lib/firebase";
import ProfileIdentity from "./ProfileIdentity";

export default function MemberProfile({ role, parameter }: { role: "Conductor" | "Pasajero"; parameter: string }) {
  const [member, setMember] = useState<{ name: string; photoURL: string } | null>(null);
  const [own, setOwn] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let controller: AbortController | undefined;
    const unsubscribe = onAuthStateChanged(auth, user => {
      controller?.abort();
      setMember(null);
      setError("");
      setLoading(true);
      if (!user) { setError("Inicia sesión para consultar este perfil."); setLoading(false); return; }
      const uid = new URLSearchParams(window.location.search).get(parameter) || user.uid;
      setOwn(uid === user.uid);
      const requestController = new AbortController();
      controller = requestController;
      const signal = requestController.signal;
      const timeout = setTimeout(() => requestController.abort(), 15000);
      void user.getIdToken().then(async token => {
        const response = await fetch(`/api/profiles?uid=${encodeURIComponent(uid)}`, { headers: { Authorization: `Bearer ${token}` }, signal, cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "No se pudo cargar el perfil.");
        if (!signal.aborted) setMember({ name: result.name || role, photoURL: result.photoURL || "" });
      }).catch(error => {
        if (!signal.aborted) setError(error instanceof Error ? error.message : "No se pudo cargar el perfil.");
        else if (controller?.signal === signal) setError("La consulta tardó demasiado. Vuelve a intentarlo.");
      }).finally(() => { clearTimeout(timeout); if (controller?.signal === signal) setLoading(false); });
    });
    return () => { const active = controller; controller = undefined; active?.abort(); unsubscribe(); };
  }, [parameter, role, attempt]);

  return <main className="member-page">
    <section className="member-card">
      <nav aria-label="Navegación del perfil"><Link href="/dashboard">Panel</Link><Link href="/messages">Mis mensajes</Link><Link href="/profile">Mi cuenta</Link></nav>
      <p className="member-kicker">LA COMUNIDAD ROADLINK</p>
      <h1>Perfil del {role.toLowerCase()}</h1>
      {loading && <p role="status">Cargando perfil…</p>}
      {error && <div role="alert"><p>{error}</p><button onClick={() => setAttempt(value => value + 1)}>Volver a intentar</button><Link href="/login">Iniciar sesión</Link></div>}
      {member && <>
        <ProfileIdentity name={member.name} photoURL={member.photoURL} role={role} size={112} />
        <p>Los buenos viajes comienzan con una conexión. Coordina los detalles de tu reserva desde tus mensajes.</p>
        <div className="member-actions"><Link href="/messages">Abrir mis mensajes</Link>{own && <Link href="/profile/edit">Editar mi perfil y foto</Link>}</div>
      </>}
    </section>
    <style>{`
      .member-page{min-height:100vh;background:#070d11;color:#f3f0e8;padding:40px 20px 120px;font-family:Arial,sans-serif}
      .member-card{max-width:820px;margin:auto;padding:44px;border:1px solid #45443a;border-radius:24px;background:linear-gradient(135deg,#121c21,#0b1217)}
      .member-card nav,.member-actions{display:flex;flex-wrap:wrap;gap:16px;margin-bottom:36px}
      .member-card a{color:#d9c39d}.member-kicker{font-size:11px;letter-spacing:.2em;color:#d9c39d;margin-top:44px}
      .member-card h1{font:normal clamp(32px,6vw,52px)/1.1 Georgia,serif;margin:16px 0 36px}
      .member-card p{line-height:1.7;max-width:580px}.member-actions{margin-top:30px;margin-bottom:0}
      .member-actions a,.member-card button{padding:14px 20px;border:1px solid #887653;border-radius:10px;background:#d9c39d;color:#10171b;text-decoration:none;font:inherit;cursor:pointer}
      .member-card a:focus-visible,.member-card button:focus-visible{outline:2px solid #f3f0e8;outline-offset:5px}
      @media(max-width:600px){.member-page{padding:20px 14px 110px}.member-card{padding:26px 20px}.member-actions{flex-direction:column}}
    `}</style>
  </main>;
}
