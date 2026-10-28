"use client";
import { useEffect, useState } from "react";
import { EmailAuthProvider, GoogleAuthProvider, TotpMultiFactorGenerator, getMultiFactorResolver, multiFactor, onAuthStateChanged,
  reauthenticateWithCredential, reauthenticateWithPopup, type MultiFactorError, type MultiFactorResolver, type TotpSecret, type User } from "firebase/auth";
import { auth } from "../../lib/firebase";
import RequireSession from "../components/RequireSession";
import TwoStepChallenge from "../components/TwoStepChallenge";
import Link from "../components/AppLink";
import styles from "../ride-now/ride-now.module.css";

export default function SecurityPage() {
  return <RequireSession purpose="Entra en tu cuenta para configurar la verificación en dos pasos."><SecurityContent /></RequireSession>;
}
function SecurityContent() {
  const [user, setUser] = useState<User | null>(null), [enabled, setEnabled] = useState(false);
  const [password, setPassword] = useState(""), [code, setCode] = useState(""), [secret, setSecret] = useState<TotpSecret | null>(null);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [resolver, setResolver] = useState<MultiFactorResolver | null>(null);
  useEffect(() => onAuthStateChanged(auth, current => { setUser(current); setEnabled(Boolean(current && multiFactor(current).enrolledFactors.length));
    setSecret(null); setPassword(""); setCode(""); setResolver(null);
  }), []);
  function failure(error: unknown) {
    const key = (error as { code?: string }).code;
    if (key === "auth/multi-factor-auth-required") { setResolver(getMultiFactorResolver(auth, error as MultiFactorError)); setMessage(""); return; }
    setMessage(key === "auth/operation-not-allowed" || key === "auth/unsupported-first-factor" || key === "auth/admin-restricted-operation"
      ? "La verificación en dos pasos todavía necesita habilitarse en el servicio de acceso de RoadLink. Tu cuenta no se ha modificado."
      : key === "auth/invalid-verification-code" ? "Código incorrecto. Usa el código actual de tu autenticador."
      : key === "auth/too-many-requests" ? "Demasiados intentos. Espera un momento."
      : key === "auth/requires-recent-login" ? "Vuelve a iniciar sesión antes de activar la protección."
      : "No se pudo completar la verificación. Revisa tus datos e inténtalo de nuevo.");
  }
  async function prepare(method: "password" | "google") {
    if (!user || busy || enabled) return;
    if (!user.emailVerified) { setMessage("Verifica tu correo antes de activar el segundo paso."); return; }
    setBusy(true); setMessage(""); setSecret(null);
    try {
      if (method === "google") await reauthenticateWithPopup(user, new GoogleAuthProvider());
      else await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email || "", password));
      setPassword("");
      setSecret(await TotpMultiFactorGenerator.generateSecret(await multiFactor(user).getSession()));
      setMessage("Añade la clave a tu autenticador y confirma con un código. Todavía no está activado.");
    } catch (error) { setPassword(""); failure(error); }
    finally { setBusy(false); }
  }
  async function enroll(event: React.FormEvent) {
    event.preventDefault();
    if (!user || !secret || busy || !/^\d{6}$/.test(code)) return;
    setBusy(true); setMessage("");
    try {
      await multiFactor(user).enroll(TotpMultiFactorGenerator.assertionForEnrollment(secret, code), "Autenticador de RoadLink");
      setSecret(null); setCode(""); setEnabled(true);
      setMessage("Verificación en dos pasos activada. En tu próximo inicio de sesión necesitarás el código del autenticador.");
    } catch (error) { setCode(""); failure(error); }
    finally { setBusy(false); }
  }
  const passwordProvider = user?.providerData.some(p => p.providerId === "password");
  const googleProvider = user?.providerData.some(p => p.providerId === "google.com");
  return <main className={styles.page}><section className={styles.hero}><Link href="/profile">← Mi perfil</Link><p className={styles.eyebrow}>SEGURIDAD ROADLINK</p><h1>Tu cuenta, con un segundo paso.</h1><p>Después de tu contraseña o acceso con Google, pide un código temporal de tu app autenticadora.</p></section>
    <section className={styles.card}>
      <h2>{enabled ? "Verificación en dos pasos activada" : "Activar una app autenticadora"}</h2>
      {message && <p role="status" aria-live="polite">{message}</p>}
      {resolver ? <TwoStepChallenge resolver={resolver} onCancel={() => setResolver(null)} onSuccess={async () => { setResolver(null); setMessage("Identidad verificada. Vuelve a iniciar la configuración."); }} /> : !enabled && !secret ? <>
        <p>Confirma tu identidad antes de añadir el autenticador. La protección solo se activa después de validar el primer código.</p>
        {passwordProvider && <form onSubmit={e => { e.preventDefault(); void prepare("password"); }}><label>Contraseña actual<input required type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></label><button disabled={busy || !password} type="submit">Confirmar identidad</button></form>}
        {googleProvider && <button disabled={busy} type="button" onClick={() => void prepare("google")}>Confirmar con Google</button>}
      </> : !enabled && secret ? <form onSubmit={enroll}>
        <p>En tu app autenticadora, añade una cuenta con clave de configuración: nombre RoadLink, tipo basado en tiempo.</p>
        <label>Clave privada de configuración<input readOnly autoComplete="off" spellCheck={false} value={secret.secretKey} aria-label="Clave privada del autenticador" /></label>
        <p>No compartas esta clave. Se muestra solo durante esta configuración y no se guarda en el perfil.</p>
        <label>Código de seis dígitos<input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} /></label>
        <button disabled={busy || code.length !== 6} type="submit">{busy ? "Activando…" : "Activar verificación en dos pasos"}</button>{" "}
        <button disabled={busy} type="button" onClick={() => { setSecret(null); setCode(""); setMessage("Configuración cancelada. No se activó el segundo paso."); }}>Cancelar configuración</button>
      </form> : <p>Firebase solicitará el código de tu autenticador cuando vuelvas a iniciar sesión. Guarda acceso a tu dispositivo.</p>}
      <p>Si pierdes el autenticador, contacta con soporte. La recuperación requiere verificar tu identidad; no se elimina el segundo factor al cambiar la contraseña.</p><Link href="/support">Contactar con soporte</Link>
    </section></main>;
}
