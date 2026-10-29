"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import firebaseApp, { auth } from "../../lib/firebase";
import { foregroundNotice } from "../../lib/push-notification";
import { usePathname } from "next/navigation";
import { useAppExperience } from "./AppExperience";

const ownerKey = "roadlink-push-owner";
function storedOwner() { try { return localStorage.getItem(ownerKey) || ""; } catch { return ""; } }
async function clearDeviceToken() {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const messaging = await import("firebase/messaging");
  if (await messaging.isSupported()) await messaging.deleteToken(messaging.getMessaging(firebaseApp));
  try { localStorage.removeItem(ownerKey); } catch { /* No local persistence. */ }
}
async function call(user: User, body?: object) {
  const response = await fetch("/api/push/subscription", { method: body ? "POST" : "GET", cache: "no-store",
    headers: { Authorization: `Bearer ${await user.getIdToken()}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "No se pudieron configurar las alertas.");
  return result;
}
export default function DriverPushControl() {
  const mode = useAppExperience();
  const pathname = usePathname();
  const [config, setConfig] = useState<{ uid: string; key: string } | null>(null);
  const [busy, setBusy] = useState(false), [registered, setRegistered] = useState(false), [message, setMessage] = useState("");
  useEffect(() => {
    let live = true;
    const stop = onAuthStateChanged(auth, async user => {
      setConfig(null); setRegistered(false); setMessage("");
      if (!user) { try { await clearDeviceToken(); } catch { /* A stale token is pruned after rejection by FCM. */ } return; }
      try {
        if (storedOwner() !== user.uid) await clearDeviceToken();
        if (!live || auth.currentUser?.uid !== user.uid) return;
        const value = await call(user);
        if (!live || auth.currentUser?.uid !== user.uid) return;
        setConfig({ uid: user.uid, key: value.vapidKey });
        setRegistered(storedOwner() === user.uid && typeof Notification !== "undefined" && Notification.permission === "granted");
      } catch { /* Existing in-app alerts remain available when push configuration is unavailable. */ }
    });
    return () => { live = false; stop(); };
  }, []);
  useEffect(() => {
    if (!config || !registered) return;
    let live = true;
    let stop: (() => void) | undefined;
    void import("firebase/messaging").then(async messaging => {
      if (!await messaging.isSupported() || !live) return;
      stop = messaging.onMessage(messaging.getMessaging(firebaseApp), async payload => {
        if (!live || auth.currentUser?.uid !== config.uid || storedOwner() !== config.uid || Notification.permission !== "granted") return;
        const notice = foregroundNotice(payload);
        if (!notice) return;
        setMessage("Notificación recibida en este dispositivo.");
        try {
          const registration = await navigator.serviceWorker.getRegistration("/");
          if (live && auth.currentUser?.uid === config.uid) await registration?.showNotification(notice.title, notice.options);
        } catch { setMessage("Llegó la notificación, pero el teléfono no permitió mostrarla. Revisa los permisos del sistema."); }
      });
    }).catch(() => { /* In-app notifications remain available. */ });
    return () => { live = false; stop?.(); };
  }, [config, registered]);
  async function enable() {
    const user = auth.currentUser;
    if (busy || !user || !config?.key || config.uid !== user.uid) return;
    if (typeof Notification === "undefined" || !navigator.serviceWorker) { setMessage("Este navegador no permite notificaciones push. Las alertas siguen disponibles dentro de RoadLink."); return; }
    setBusy(true); setMessage("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("No se concedió el permiso. Puedes cambiarlo en los ajustes del navegador.");
      const messaging = await import("firebase/messaging");
      if (!await messaging.isSupported()) throw new Error("Este dispositivo no admite notificaciones push.");
      const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
      await new Promise<void>((resolve, reject) => {
        if (registration.active) { resolve(); return; }
        const worker = registration.installing || registration.waiting;
        if (!worker) { reject(new Error("No se pudo preparar el servicio de alertas.")); return; }
        const timer = setTimeout(() => { worker.removeEventListener("statechange", changed); reject(new Error("El servicio de alertas tardó demasiado. Inténtalo de nuevo.")); }, 15000);
        function changed() { if (worker?.state === "activated") { clearTimeout(timer); worker.removeEventListener("statechange", changed); resolve(); } else if (worker?.state === "redundant") { clearTimeout(timer); worker.removeEventListener("statechange", changed); reject(new Error("No se pudo activar el servicio de alertas.")); } }
        worker.addEventListener("statechange", changed); changed();
      });
      const token = await messaging.getToken(messaging.getMessaging(firebaseApp), { vapidKey: config.key, serviceWorkerRegistration: registration });
      if (auth.currentUser?.uid !== user.uid) { await clearDeviceToken(); throw new Error("La cuenta cambió. Vuelve a activar las alertas desde tu cuenta."); }
      await call(user, { action: "enable", token });
      if (auth.currentUser?.uid === user.uid) { try { localStorage.setItem(ownerKey, user.uid); } catch { /* Registration remains usable without local persistence. */ } setRegistered(true); setMessage("Dispositivo registrado para recibir notificaciones de Pasajero y Conductor. Mantén los permisos activados en el teléfono."); }
    } catch { setMessage("No se pudieron activar las alertas push. Revisa el permiso del navegador y vuelve a intentarlo. Las alertas dentro de la app siguen disponibles."); }
    finally { setBusy(false); }
  }
  async function disable() {
    if (busy) return;
    setBusy(true);
    try {
      const user = auth.currentUser;
      const registration = await navigator.serviceWorker?.getRegistration("/");
      if (user && config?.uid === user.uid && config.key && registration && storedOwner() === user.uid) {
        const messaging = await import("firebase/messaging");
        const token = await messaging.getToken(messaging.getMessaging(firebaseApp), { vapidKey: config.key, serviceWorkerRegistration: registration });
        await call(user, { action: "disable", token });
      }
      await clearDeviceToken(); setRegistered(false); setMessage("Notificaciones push desactivadas para ambas apps en este navegador. Las alertas dentro de la app siguen disponibles."); }
    catch { setMessage("No se pudieron desactivar. Revisa los permisos de notificaciones del navegador."); }
    finally { setBusy(false); }
  }
  async function testPush() {
    const user = auth.currentUser;
    if (busy || !user || config?.uid !== user.uid) return;
    setBusy(true);
    setMessage("Enviando la notificación de prueba…");
    try {
      const response = await fetch("/api/push/test", { method: "POST", headers: { Authorization: `Bearer ${await user.getIdToken()}`, "Content-Type": "application/json" }, body: JSON.stringify({ appExperience: mode }) });
      const result = await response.json();
      if (!response.ok) throw new Error();
      if (result.repeated) { setMessage("Esta prueba ya se envió durante este minuto. Espera un minuto para enviar otra."); return; }
      if (!result.accepted) { setMessage(result.status === "no_devices" ? "No hay un dispositivo activo para esta cuenta. Pulsa Volver a registrar este dispositivo y repite la prueba." : "El servicio push no aceptó el envío. Vuelve a registrar este dispositivo y prueba de nuevo."); return; }
      setMessage("El servicio push aceptó la prueba. Comprueba la barra de notificaciones del teléfono; esto todavía no confirma que la hayas recibido.");
    } catch { setMessage("No se pudo enviar la prueba. Activa o vuelve a registrar las notificaciones en este dispositivo."); }
    finally { setBusy(false); }
  }
  const showSettings = mode && (/^\/(conductor|pasajero)\/?$/.test(pathname) || /\/(profile|security)$/.test(pathname));
  if (!showSettings || !config) return null;
  return <section className="driverPush" aria-label="Alertas con la app cerrada">
    <h2>Notificaciones push</h2>
    <p>{config.key ? "Recibe mensajes, propuestas y actualizaciones de reservas en Pasajero y Conductor, incluso con la app en segundo plano." : "Las alertas dentro de la app están disponibles. Las notificaciones con la app cerrada están pendientes de configuración."}</p>
    <button type="button" onClick={() => void enable()} disabled={busy || !config.key}>{busy ? "Actualizando…" : registered ? "Volver a registrar este dispositivo" : "Activar notificaciones en este dispositivo"}</button>
    {registered && <button type="button" onClick={() => void testPush()} disabled={busy}>Enviar notificación de prueba</button>}
    {config.key && <button type="button" onClick={() => void disable()} disabled={busy}>Desactivar en este navegador</button>}
    {message && <p role="status" aria-live="polite">{message}</p>}
    <style>{`.driverPush{box-sizing:border-box;margin:16px auto;padding:20px;max-width:1080px;border:1px solid #364940;border-radius:18px;background:#101e20;color:#f7f5ef}.driverPush h2{font-size:20px}.driverPush p{line-height:1.6}.driverPush button{padding:13px 18px;margin:6px 8px 6px 0;min-height:48px;border:1px solid #789b82;border-radius:10px;background:#193b2b;color:#fff;font:inherit;cursor:pointer}.driverPush button:disabled{opacity:.55;cursor:default}.driverPush button:focus-visible{outline:3px solid #22c55e;outline-offset:4px}@media(max-width:540px){.driverPush{margin:12px}.driverPush button{width:100%;margin-right:0}}`}</style>
  </section>;
}
