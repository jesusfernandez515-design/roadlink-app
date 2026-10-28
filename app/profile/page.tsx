"use client";

import { useAppRouter } from "../components/useAppRouter";
import Link from "../components/AppLink";
import ProfileIdentity from "../components/ProfileIdentity";
import { useAppExperience } from "../components/AppExperience";
import { useEffect, useMemo, useState } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";

type UserProfile = {
  name?: string;
  email?: string;
  role?: string;
  photoURL?: string;
  emailVerified?: boolean;
  verified?: boolean;
  driverVerified?: boolean;
  licenseVerified?: boolean;
  phoneVerified?: boolean;
  verificationStatus?: string;
  bio?: string;
  city?: string;
  state?: string;
};

export default function ProfilePage() {
  const appRouter = useAppRouter();
  const isPassenger = useAppExperience() === "passenger";
  const [profile, setProfile] = useState<UserProfile>({});
  const [message, setMessage] = useState("Cargando perfil…");
  const [authState, setAuthState] = useState<"loading" | "signedOut" | "signedIn">("loading");
  const [profileLoaded, setProfileLoaded] = useState(false);


  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;
    let revision = 0;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      const currentRevision = ++revision;
      unsubscribeProfile?.();
      unsubscribeProfile = undefined;
      setProfile({});
      setProfileLoaded(false);
      setMessage("Cargando perfil…");
      setAuthState(user ? "signedIn" : "signedOut");
      if (!user) {
        setMessage("Inicia sesión para consultar tu perfil.");
        return;
      }

      const userEmail = user.email || "";
      const fallbackName = user.displayName || "RoadLink User";
      const fallbackPhoto = user.photoURL || "";

      const userRef = doc(db, "users", user.uid);

      try {
        const existingUser = await getDoc(userRef);
        if (currentRevision !== revision) return;

        if (!existingUser.exists()) {
          await setDoc(
            userRef,
            {
              name: fallbackName,
              email: userEmail,
              role: "member",
              photoURL: fallbackPhoto,
              emailVerified: Boolean(user.emailVerified),
              provider: "email",
              verified: false,
              phoneVerified: false,
              driverVerified: false,
              licenseVerified: false,
              verificationStatus: "not_submitted",
              bio: "",
              city: "",
              state: "",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        } else {
          const existingData = existingUser.data() as UserProfile | undefined;

          await setDoc(
            userRef,
            {
              email: userEmail,
              emailVerified: Boolean(user.emailVerified),
              photoURL: existingData?.photoURL || fallbackPhoto || "",
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        }
      } catch (error: unknown) {
        setMessage(error instanceof Error ? error.message : "Something went wrong.");
      }

      if (currentRevision !== revision) return;
      unsubscribeProfile = onSnapshot(
        userRef,
        (snapshot) => {
          if (currentRevision !== revision) return;
          const data = snapshot.data() as UserProfile | undefined;
          const savedPhoto = data?.photoURL || fallbackPhoto || "";



          setProfile({
            name: data?.name || fallbackName,
            email: data?.email || userEmail,
            role: data?.role || "member",
            photoURL: savedPhoto,
            emailVerified: Boolean(user.emailVerified || data?.emailVerified),
            verified: Boolean(data?.verified),
            driverVerified: Boolean(data?.driverVerified),
            licenseVerified: Boolean(data?.licenseVerified),
            phoneVerified: Boolean(data?.phoneVerified),
            verificationStatus: data?.verificationStatus || "not_submitted",
            bio: data?.bio || "",
            city: data?.city || "",
            state: data?.state || "",
          });

          setProfileLoaded(true);
          setMessage("");
        },
        (error) => {
          if (currentRevision === revision) setMessage(error.message);
        }
      );
    });

    return () => {
      revision++;
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const displayName = profile.name || "RoadLink User";
  const displayEmail = profile.email || "Sin correo registrado";
  const displayPhoto = profile.photoURL || "";

  const initials = useMemo(() => {
    const parts = displayName.trim().split(" ").filter(Boolean);
    const first = parts[0]?.[0] || "";
    const second = parts[1]?.[0] || "";
    return `${first}${second}`.toUpperCase() || displayEmail[0]?.toUpperCase() || "R";
  }, [displayName, displayEmail]);

  const driverVerified =
    profile.driverVerified === true ||
    profile.verified === true ||
    profile.verificationStatus === "approved";

  const trustScore = useMemo(() => {
    return Math.min(
      100,
      40 +
        (profile.emailVerified ? (isPassenger ? 30 : 15) : 0) +
        (profile.phoneVerified ? (isPassenger ? 30 : 15) : 0) +
        (!isPassenger && driverVerified ? 25 : 0) +
        (!isPassenger && profile.licenseVerified ? 5 : 0)
    );
  }, [
    isPassenger,
    profile.emailVerified,
    profile.phoneVerified,
    profile.licenseVerified,
    driverVerified,
  ]);

  const trustLevel =
    trustScore >= 85 ? "Perfil avanzado" : trustScore >= 65 ? "Perfil completo" : "Perfil básico";

  async function handleSignOut() {
    await signOut(auth);
    appRouter.replace("/login");
  }


  if (authState !== "signedIn" || !profileLoaded) {
    const signedOut = authState === "signedOut";
    return (
      <main style={{ minHeight: "70vh", padding: "32px 16px 140px", color: "#f1e0bd" }}>
        <section style={{ maxWidth: 600, margin: "0 auto", padding: 28, borderRadius: 24, background: "#10191e", border: "1px solid #3c3b32" }}>
          <p style={{ letterSpacing: "0.12em", fontSize: 12 }}>TU CUENTA ROADLINK</p>
          <h1 style={{ fontSize: 32 }}>{signedOut ? "Bienvenido a RoadLink" : "Cargando tu perfil"}</h1>
          <p role="status" aria-live="polite" style={{ color: "#d4d4d8", lineHeight: 1.6 }}>
            {signedOut ? "Inicia sesión para ver tu perfil, tus viajes y tus reservas." : message || "Estamos recuperando tu información."}
          </p>
          {signedOut && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 24 }}>
              <Link href="/login" style={{ padding: "14px 20px", borderRadius: 12, background: "#d9c39d", color: "#070d11", fontWeight: 700, textDecoration: "none" }}>Iniciar sesión</Link>
              <Link href="/register" style={{ padding: "14px 20px", borderRadius: 12, border: "1px solid #d9c39d", color: "#f1e0bd", fontWeight: 700, textDecoration: "none" }}>Crear cuenta</Link>
            </div>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="hero">
        <div className="heroTop">
          <div style={{ flexShrink: 0 }}>
            <ProfileIdentity photoURL={displayPhoto} name={displayName} role="Perfil" size={80} showName={false} />
            <Link href="/profile/edit" style={{ display: "block", fontSize: 12, textAlign: "center", marginTop: 8 }}>Cambiar foto</Link>
          </div>

          <div className="heroText">
            <p className="eyebrow">Tu cuenta RoadLink</p>
            <h1>Bienvenido, {displayName}</h1>
            <p className="email">{displayEmail}</p>
          </div>
        </div>

        {profile.bio && <p className="bio">{profile.bio}</p>}
        {!displayPhoto && <p className="message">Añade tu foto para que tus acompañantes puedan reconocerte. <Link href="/profile/edit">Completar mi perfil</Link></p>}

        <div className="badges">
          <span className={profile.emailVerified ? "badge good" : "badge bad"}>{profile.emailVerified ? "✓ Correo verificado" : "Correo pendiente"}</span>
          <span className="badge role">{isPassenger ? "Pasajero" : profile.role === "driver" ? "Conductor" : profile.role === "admin" ? "Administración" : "Miembro"}</span>
          <span className="badge good">{trustLevel}</span>
          {!isPassenger && <span className={driverVerified ? "badge good" : "badge bad"}>
            {driverVerified ? "✓ Conductor verificado" : "Conductor sin verificar"}
          </span>}
        </div>

        {message && <p className="message">{message}</p>}
      </section>

      <section className="statsGrid">
        <Stat title="Información del perfil" value={`${trustScore}/100`} icon="✅" />
        {isPassenger
          ? <Stat title="Teléfono" value={profile.phoneVerified ? "Verificado" : "Pendiente"} icon="📱" />
          : <Stat title="Conductor" value={driverVerified ? "Verificado" : "Pendiente"} icon="🚗" />}
        <Stat title="Correo" value={profile.emailVerified ? "Verificado" : "Pendiente"} icon="📧" />
        <Stat title="Ubicación" value={profile.city || profile.state ? `${profile.city || ""} ${profile.state || ""}` : "Sin añadir"} icon="📍" />
      </section>

      <section className="trustCard">
        <div className="trustHeader">
          <div>
            <p className="eyebrow">Información del perfil</p>
            <h2>{trustScore}/100</h2>
          </div>
          <strong>{trustLevel}</strong>
        </div>

        <div className="bar">
          <div style={{ width: `${trustScore}%` }} />
        </div>
      </section>

      <section className="sectionCard">
        <p className="eyebrow">Accesos principales</p>
        <h2>Tu centro de control</h2>

        <div className="buttonGrid">
          <ProfileLink href="/profile/edit" icon="📝" title="Editar perfil" />
          {!isPassenger && <>
            <ProfileLink href="/driver-verification" icon="🛡️" title="Verificación" />
            <ProfileLink href="/dashboard/driver" icon="🚗" title="Panel del conductor" />
          </>}
          {isPassenger && <ProfileLink href="/find-ride" icon="🔎" title="Buscar viaje" />}
          <ProfileLink href="/wallet" icon="💰" title="Cartera" />
        </div>
      </section>

      <section className="sectionCard">
        <p className="eyebrow">Actividad RoadLink</p>
        <h2>Mi cuenta</h2>

        <div className="buttonGrid">
          {!isPassenger && <ProfileLink href="/my-rides" icon="🚘" title="Mis viajes" />}
          <ProfileLink href="/my-bookings" icon="🎟️" title="Mis reservas" />
          <ProfileLink href="/reviews" icon="⭐" title="Reseñas" />
          <ProfileLink href="/notifications" icon="🔔" title="Notificaciones" />
          <ProfileLink href="/messages" icon="💬" title="Mensajes" />
          <button onClick={handleSignOut} className="actionButton danger">
            <span>🚪</span>
            <strong>Cerrar sesión</strong>
          </button>
        </div>
      </section>

      <style>{`
        * {
          box-sizing: border-box;
        }

        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.22), transparent 34%),
            radial-gradient(circle at bottom left, rgba(16,185,129,0.12), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          padding: 16px;
          padding-bottom: 140px;
          font-family: Arial, sans-serif;
        }

        .hero,
        .statsGrid,
        .trustCard,
        .sectionCard {
          max-width: 860px;
          margin-left: auto;
          margin-right: auto;
        }

        .hero,
        .stat,
        .trustCard,
        .sectionCard,
        .actionButton {
          background: rgba(8, 13, 25, 0.92);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 18px 60px rgba(0,0,0,0.45);
          backdrop-filter: blur(16px);
        }

        .hero {
          border-radius: 28px;
          padding: 22px;
          margin-bottom: 14px;
          overflow: hidden;
        }

        .heroTop {
          display: grid;
          grid-template-columns: 88px 1fr;
          gap: 14px;
          align-items: center;
        }

        .avatarShell {
          width: 88px;
          height: 88px;
          border-radius: 50%;
          padding: 4px;
          border: 2px solid rgba(34,197,94,0.5);
          box-shadow: 0 12px 40px rgba(34,197,94,0.25);
          background: rgba(34,197,94,0.12);
          overflow: hidden;
          flex-shrink: 0;
        }

        .avatar,
        .avatarImage {
          width: 100%;
          height: 100%;
          border-radius: 50%;
        }

        .avatar {
          background: linear-gradient(135deg, #22c55e, #16a34a);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          font-weight: 900;
          text-align: center;
          line-height: 1;
        }

        .avatarImage {
          object-fit: cover;
          display: block;
          background: #020617;
        }

        .heroText {
          min-width: 0;
        }

        .eyebrow {
          margin: 0 0 7px;
          color: #22c55e;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.09em;
          text-transform: uppercase;
        }

        h1 {
          font-size: 28px;
          line-height: 1.05;
          margin: 0 0 8px;
          letter-spacing: -0.8px;
          overflow-wrap: anywhere;
        }

        h2 {
          color: #22c55e;
          font-size: 24px;
          margin: 0 0 16px;
        }

        .email {
          color: #a1a1aa;
          font-size: 14px;
          margin: 0;
          overflow-wrap: anywhere;
        }

        .bio {
          color: #d4d4d8;
          line-height: 1.45;
          margin: 16px 0 0;
        }

        .badges {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
          margin-top: 16px;
        }

        .badge {
          min-width: 0;
          padding: 9px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 900;
          text-align: center;
          text-transform: capitalize;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .good {
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .bad {
          color: #fca5a5;
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.35);
        }

        .role {
          color: #e5e7eb;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
        }

        .message {
          color: #22c55e;
          font-weight: 900;
          margin: 14px 0 0;
        }

        .statsGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          margin-bottom: 14px;
        }

        .stat {
          border-radius: 20px;
          padding: 14px;
          min-height: 100px;
        }

        .statIcon {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 10px;
        }

        .stat span {
          display: block;
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 6px;
        }

        .stat strong {
          display: block;
          color: #22c55e;
          font-size: 18px;
          overflow-wrap: anywhere;
        }

        .trustCard,
        .sectionCard {
          border-radius: 24px;
          padding: 20px;
          margin-bottom: 14px;
        }

        .trustHeader {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          margin-bottom: 12px;
        }

        .trustHeader h2 {
          margin: 0;
          font-size: 32px;
        }

        .trustHeader strong {
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          padding: 8px 12px;
          border-radius: 999px;
        }

        .bar {
          height: 12px;
          border-radius: 999px;
          background: rgba(255,255,255,0.08);
          overflow: hidden;
        }

        .bar div {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(135deg, #22c55e, #16a34a);
        }

        .buttonGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }

        .actionButton {
          min-height: 74px;
          border-radius: 18px;
          padding: 14px;
          color: white;
          text-decoration: none;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          border: 1px solid rgba(255,255,255,0.12);
          width: 100%;
        }

        .actionButton span {
          font-size: 22px;
        }

        .actionButton strong {
          font-size: 14px;
          line-height: 1.15;
        }

        .actionButton:hover {
          border-color: rgba(34,197,94,0.5);
          background: rgba(34,197,94,0.08);
        }

        .danger {
          background: rgba(239,68,68,0.13);
          border-color: rgba(239,68,68,0.35);
        }

        .danger:hover {
          background: rgba(239,68,68,0.2);
          border-color: rgba(239,68,68,0.55);
        }

        @media (min-width: 780px) {
          .page {
            padding: 24px;
            padding-bottom: 140px;
          }

          .hero {
            padding: 30px;
          }

          .heroTop {
            grid-template-columns: 120px 1fr;
            gap: 20px;
          }

          .avatarShell {
            width: 120px;
            height: 120px;
          }

          .avatar {
            font-size: 34px;
          }

          h1 {
            font-size: 44px;
          }

          .badges {
            grid-template-columns: repeat(4, auto);
            justify-content: start;
          }

          .statsGrid {
            grid-template-columns: repeat(4, 1fr);
          }

          .buttonGrid {
            grid-template-columns: repeat(3, 1fr);
          }
        }
      `}</style>
    </main>
  );
}

function Stat({
  icon,
  title,
  value,
}: {
  icon: string;
  title: string;
  value: string;
}) {
  return (
    <div className="stat">
      <div className="statIcon">{icon}</div>
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ProfileLink({
  href,
  icon,
  title,
}: {
  href: string;
  icon: string;
  title: string;
}) {
  return (
    <Link href={href} className="actionButton">
      <span>{icon}</span>
      <strong>{title}</strong>
    </Link>
  );
}
