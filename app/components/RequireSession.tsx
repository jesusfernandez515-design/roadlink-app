"use client";
import { useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../lib/firebase";
import Link from "./AppLink";

export default function RequireSession({ children, purpose }: { children: ReactNode; purpose: string }) {
  const [session, setSession] = useState<"loading" | "guest" | "member">("loading");
  const [accountId, setAccountId] = useState("");
  const [error, setError] = useState(false);
  useEffect(() => onAuthStateChanged(auth, user => {
    setAccountId(user?.uid || "");
    setSession(user ? "member" : "guest");
    setError(false);
  }, () => { setSession("guest"); setError(true); }), []);
  if (session === "member") return <div key={accountId}>{children}</div>;
  return (
    <main style={{ minHeight: "70vh", padding: "32px 16px 150px", color: "#f1e0bd" }}>
      <section style={{ maxWidth: 600, margin: "0 auto", padding: 28, borderRadius: 24, background: "#10191e", border: "1px solid #3c3b32" }}>
        <p style={{ letterSpacing: "0.12em", fontSize: 12 }}>TU CUENTA ROADLINK</p>
        <h1 style={{ fontSize: 32 }}>{session === "loading" ? "Comprobando tu sesión" : "Inicia sesión para continuar"}</h1>
        <p role="status" aria-live="polite" style={{ color: "#d4d4d8", lineHeight: 1.6 }}>
          {session === "loading" ? "Estamos comprobando tu acceso." : error ? "No pudimos comprobar tu sesión. Vuelve a iniciar sesión." : purpose}
        </p>
        {session === "guest" && <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 24 }}>
          <Link href="/login" style={{ padding: "14px 20px", borderRadius: 12, background: "#d9c39d", color: "#070d11", fontWeight: 700, textDecoration: "none" }}>Iniciar sesión</Link>
          <Link href="/register" style={{ padding: "14px 20px", borderRadius: 12, border: "1px solid #d9c39d", color: "#f1e0bd", fontWeight: 700, textDecoration: "none" }}>Crear cuenta</Link>
        </div>}
      </section>
    </main>
  );
}
