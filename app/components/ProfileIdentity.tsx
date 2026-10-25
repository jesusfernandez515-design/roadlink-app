"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { UserRound } from "lucide-react";
import { auth } from "../../lib/firebase";

export default function ProfileIdentity({ uid, name = "", role, size = 52, photoURL = "", showName = true }: {
  uid?: string; name?: string; role: "Conductor" | "Pasajero" | "Perfil"; size?: number; photoURL?: string; showName?: boolean;
}) {
  const [profile, setProfile] = useState({ name: "", photoURL: "" });
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    let controller: AbortController | undefined;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      controller?.abort();
      setProfile({ name: "", photoURL: "" });
      if (!user || !uid) return;
      controller = new AbortController();
      const signal = controller.signal;
      void user.getIdToken().then(async (token) => {
        const response = await fetch(`/api/profiles?uid=${encodeURIComponent(uid)}`, { headers: { Authorization: `Bearer ${token}` }, signal, cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (!signal.aborted) setProfile({ name: data.name || "", photoURL: data.photoURL || "" });
      }).catch(() => { /* A missing photo must not prevent booking or payment. */ });
    });
    return () => { controller?.abort(); unsubscribe(); };
  }, [uid]);
  const image = profile.photoURL || photoURL;
  useEffect(() => setBroken(false), [image]);
  const label = profile.name || name || role;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 12, minWidth: 0, maxWidth: "100%" }}>
    <span style={{ width: size, height: size, flexShrink: 0, borderRadius: "50%", overflow: "hidden", display: "grid", placeItems: "center", background: "#182124", border: "1px solid #887653", color: "#d9c39d" }}>
      {image && !broken ? <img src={image} alt={`Foto de ${label}`} onError={() => setBroken(true)} referrerPolicy="no-referrer" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <UserRound size={size * 0.48} aria-label={`${role} sin foto`} />}
    </span>
    {showName && <span style={{ minWidth: 0, overflowWrap: "anywhere" }}><small style={{ display: "block", color: "#b8aa92" }}>{role}</small><span>{label}</span>{(!image || broken) && <small style={{ display: "block", color: "#a6a5a0" }}>Sin foto de perfil</small>}</span>}
  </span>;
}
