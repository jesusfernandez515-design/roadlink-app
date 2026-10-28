"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";
import { useAppExperience } from "./AppExperience";
import Link from "./AppLink";

type Alert = { id: string; expiresAt: string };

export default function LastMinuteAlerts() {
  const mode = useAppExperience();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (mode !== "driver") return;
    let unsubscribe: (() => void) | undefined;
    setNow(Date.now());
    const stopAuth = onAuthStateChanged(auth, user => {
      unsubscribe?.(); setAlerts([]);
      if (!user) return;
      const uid = user.uid;
      unsubscribe = onSnapshot(query(collection(db, "notifications"), where("userId", "==", uid), where("read", "==", false)), snapshot => {
        if (auth.currentUser?.uid !== uid) return;
        setAlerts(snapshot.docs.flatMap(row => {
          const value = row.data();
          return value.type === "instant_request" && !value.closed ? [{ id: row.id, expiresAt: value.expiresAt }] : [];
        }));
        setNow(Date.now());
      }, () => setAlerts([]));
    });
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => { stopAuth(); unsubscribe?.(); clearInterval(timer); };
  }, [mode]);
  const count = alerts.filter(value => Date.parse(value.expiresAt) > now).length;
  if (mode !== "driver" || !count) return null;
  return <aside className="lastMinuteAlert" role="status" aria-live="polite">
    <span aria-hidden="true">🔔</span>
    <div><strong>{count === 1 ? "Alguien necesita viajar de inmediato" : `${count} personas necesitan viajar de inmediato`}</strong><p>Solicitudes de viajes de último minuto</p></div>
    <Link href="/ride-now">Ver solicitudes</Link>
    <style>{`.lastMinuteAlert{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin:16px auto;padding:18px;max-width:1080px;border:1px solid #22c55e;border-radius:16px;background:#102d23;color:#f3fff7;font:inherit;box-shadow:0 5px 28px #22c55e20}.lastMinuteAlert>span{font-size:26px}.lastMinuteAlert p{margin:6px 0;font-size:14px}.lastMinuteAlert a{display:inline-flex;justify-content:center;align-items:center;margin-left:auto;padding:12px 18px;min-height:44px;box-sizing:border-box;border-radius:10px;background:#22c55e;color:#07170f;text-decoration:none;font-weight:700}.lastMinuteAlert a:focus-visible{outline:3px solid white;outline-offset:4px}@media(max-width:540px){.lastMinuteAlert{margin:12px}.lastMinuteAlert a{width:100%;margin:0}}`}</style>
  </aside>;
}
