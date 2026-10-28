"use client";
import { useState } from "react";
import { TotpMultiFactorGenerator, type MultiFactorResolver, type User } from "firebase/auth";
import { resolveTotpChallenge } from "../../lib/mfa-flow";

export default function TwoStepChallenge({ resolver, onSuccess, onCancel }: {
  resolver: MultiFactorResolver; onSuccess: (user: User) => Promise<void>; onCancel: () => void;
}) {
  const factors = resolver.hints.filter(h => h.factorId === TotpMultiFactorGenerator.FACTOR_ID);
  const [factorId, setFactorId] = useState(factors[0]?.uid || "");
  const [code, setCode] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !factorId || !/^\d{6}$/.test(code)) return;
    setBusy(true); setError("");
    try {
      const result = await resolveTotpChallenge(resolver, factorId, code);
      setCode(""); await onSuccess(result.user);
    } catch { setError("El código no es válido o caducó. Usa el código actual de tu app autenticadora."); setCode(""); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit}>
    <h2>Verifica que eres tú</h2>
    {factors.length ? <>
      <p>Introduce el código de seis dígitos de tu app autenticadora.</p>
      {factors.length > 1 && <label>Autenticador<select value={factorId} onChange={e => setFactorId(e.target.value)}>{factors.map((factor, i) => <option key={factor.uid} value={factor.uid}>{factor.displayName || `Autenticador ${i + 1}`}</option>)}</select></label>}
      <label>Código de verificación<input required aria-label="Código de verificación" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} /></label>
      <button className="primary" type="submit" disabled={busy || code.length !== 6}>{busy ? "Verificando…" : "Verificar y continuar"}</button>
    </> : <p>Esta cuenta usa un segundo factor que aún no está disponible en esta pantalla. Contacta con soporte. El acceso permanece bloqueado.</p>}
    {error && <p role="alert">{error}</p>}
    <button type="button" disabled={busy} onClick={() => { setCode(""); onCancel(); }}>Volver al inicio de sesión</button>
    <p>Si perdiste el autenticador, contacta con soporte para verificar tu identidad. Restablecer la contraseña no elimina el segundo paso.</p>
  </form>;
}
