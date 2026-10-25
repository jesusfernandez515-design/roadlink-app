"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../lib/firebase";
import ProfileIdentity from "../components/ProfileIdentity";
import styles from "./chat.module.css";

type Chat = { id: string; driverId: string; passengerId: string; driverEmail: string; passengerEmail: string; from: string; to: string };
type Message = { id: string; senderId: string; text: string; createdAt: string };
async function requestChat(body?: object, chatId?: string, signal?: AbortSignal) {
  const user = auth.currentUser;
  if (!user) throw new Error("Inicia sesión para consultar tus mensajes.");
  const token = await user.getIdToken();
  const response = await fetch(chatId ? `/api/chat?chatId=${encodeURIComponent(chatId)}` : "/api/chat", { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined, cache: "no-store", signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "No se pudo cargar la conversación.");
  return result;
}
export default function ChatPage() {
  return <Suspense fallback={<main className={styles.page}>Cargando conversación…</main>}><Conversation /></Suspense>;
}
function Conversation() {
  const params = useSearchParams();
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [uid, setUid] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [canSend, setCanSend] = useState(false);
  const [retry, setRetry] = useState(0);
  const pending = useRef<{ text: string; id: string } | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const chatId = params.get("chatId") || "";
  const rideId = params.get("rideId") || "";
  const passengerId = params.get("passengerId") || "";
  useEffect(() => {
    let controller: AbortController | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    const unsubscribe = onAuthStateChanged(auth, user => {
      controller?.abort(); if (timer) clearInterval(timer);
      setChat(null); setMessages([]); setText(""); pending.current = null; setCanSend(false); setLoading(true); setUid(user?.uid || "");
      if (!user) { setError("Inicia sesión para abrir esta conversación."); setLoading(false); return; }
      controller = new AbortController(); const signal = controller.signal;
      void (async () => {
        try {
          let id = chatId;
          if (!id) {
            if (!rideId) throw new Error("Abre la conversación desde una reserva o desde la lista de pasajeros.");
            id = (await requestChat({ action: "open", rideId, ...(passengerId ? { passengerId } : {}) }, undefined, signal)).chatId;
          }
          let inFlight = false;
          const refresh = async () => {
            if (inFlight || signal.aborted || document.hidden) return;
            inFlight = true;
            try {
              const result = await requestChat(undefined, id, signal);
              if (signal.aborted) return;
              setChat(result.chat); setMessages(result.messages); setCanSend(result.canSend); setError(""); setLoading(false);
              await requestChat({ action: "read", chatId: id }, undefined, signal);
            } catch (e) { if (!signal.aborted) { setError(e instanceof Error ? e.message : "No se pudo actualizar el chat."); setLoading(false); } }
            finally { inFlight = false; }
          };
          await refresh();
          if (!signal.aborted) timer = setInterval(() => { void refresh(); }, 5000);
        } catch (e) { if (!signal.aborted) { setError(e instanceof Error ? e.message : "No se pudo abrir el chat."); setLoading(false); } }
      })();
    });
    return () => { unsubscribe(); controller?.abort(); if (timer) clearInterval(timer); };
  }, [chatId, rideId, passengerId, retry]);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [messages.length]);
  async function send(event: React.FormEvent) {
    event.preventDefault();
    const value = text.trim();
    if (!chat || !value || sending || !canSend) return;
    if (pending.current?.text !== value) pending.current = { text: value, id: crypto.randomUUID() };
    setSending(true); setError("");
    try {
      await requestChat({ action: "send", chatId: chat.id, text: value, messageId: pending.current.id });
      pending.current = null; setText("");
      const result = await requestChat(undefined, chat.id);
      if (auth.currentUser?.uid === uid) { setMessages(result.messages); setCanSend(result.canSend); }
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo enviar. Puedes reintentar sin duplicar el mensaje."); }
    finally { setSending(false); }
  }
  const otherId = chat ? uid === chat.driverId ? chat.passengerId : chat.driverId : "";
  const otherName = chat ? uid === chat.driverId ? chat.passengerEmail : chat.driverEmail : "";
  return <main className={styles.page}><section className={styles.shell}>
    <nav className={styles.nav}><Link href="/messages">← Mis mensajes</Link><Link href="/my-bookings">Mis reservas</Link><Link href="/my-rides">Mis viajes</Link></nav>
    <header className={styles.header}><p className={styles.eyebrow}>CONVERSACIONES ROADLINK</p><h1>Comparte el camino.</h1>{chat && <><ProfileIdentity uid={otherId} name={otherName} role={uid === chat.driverId ? "Pasajero" : "Conductor"} /><p className={styles.route}>{chat.from} → {chat.to}</p></>}</header>
    {error && <div className={styles.error} role="alert">{error}<button onClick={() => setRetry(n => n + 1)}>Reintentar</button></div>}
    {loading ? <p role="status">Cargando conversación…</p> : <>
      <div className={styles.history} role="log" aria-label="Historial de mensajes" aria-live="polite">
        {!messages.length && chat && <p className={styles.empty}>Todavía no hay mensajes. Coordina aquí los detalles del viaje.</p>}
        {messages.map(message => <article className={`${styles.message} ${message.senderId === uid ? styles.mine : ""}`} key={message.id}><p>{message.text}</p><small>{message.senderId === uid ? "Tú" : "Tu acompañante"} · {new Date(message.createdAt).toLocaleString("es-PR", { timeZone: "America/Puerto_Rico" })}</small></article>)}<div ref={end} />
      </div>
      {chat && !canSend && <p className={styles.empty}>La reserva está cerrada. Puedes consultar los mensajes anteriores.</p>}
      {chat && <form className={styles.composer} onSubmit={send}><label htmlFor="chat-message">Tu mensaje</label><textarea id="chat-message" value={text} onChange={e => setText(e.target.value)} maxLength={2000} placeholder="Escribe los detalles de tu viaje…" disabled={!canSend || sending} /><div><small>{text.length}/2000</small><button type="submit" disabled={!canSend || sending || !text.trim()}>{sending ? "Enviando…" : "Enviar mensaje"}</button></div></form>}
    </>}
  </section></main>;
}
