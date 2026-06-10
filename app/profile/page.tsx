"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
};

export default function ProfilePage() {
  const [userId, setUserId] = useState("");
  const [profile, setProfile] = useState<UserProfile>({});
  const [avatar, setAvatar] = useState("R");
  const [message, setMessage] = useState("Loading profile...");

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setMessage("Please sign in to view your profile.");
        return;
      }

      const userEmail = user.email || "";
      const fallbackName = user.displayName || "RoadLink User";
      const fallbackPhoto = user.photoURL || "";

      setUserId(user.uid);
      setAvatar(userEmail ? userEmail.charAt(0).toUpperCase() : "R");

      const userRef = doc(db, "users", user.uid);

      try {
        const existingUser = await getDoc(userRef);

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
              createdAt: new Date().toISOString(),
            },
            { merge: true }
          );
        } else {
          await setDoc(
            userRef,
            {
              email: userEmail,
              emailVerified: Boolean(user.emailVerified),
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        }
      } catch (error: unknown) {
        setMessage(error instanceof Error ? error.message : "Something went wrong.");
      }

      unsubscribeProfile = onSnapshot(
        userRef,
        (snapshot) => {
          const data = snapshot.data() as UserProfile | undefined;

          setProfile({
            name: data?.name || fallbackName,
            email: data?.email || userEmail,
            role: data?.role || "member",
            photoURL: data?.photoURL || fallbackPhoto,
            emailVerified: Boolean(user.emailVerified || data?.emailVerified),
            verified: Boolean(data?.verified),
            driverVerified: Boolean(data?.driverVerified),
            licenseVerified: Boolean(data?.licenseVerified),
            phoneVerified: Boolean(data?.phoneVerified),
            verificationStatus: data?.verificationStatus || "not_submitted",
          });

          setMessage("");
        },
        (error) => setMessage(error.message)
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const displayName = profile.name || "RoadLink User";
  const displayEmail = profile.email || "No email found";
  const displayPhoto = profile.photoURL || "";

  const driverVerified =
    profile.driverVerified === true ||
    profile.verified === true ||
    profile.verificationStatus === "approved";

  const trustScore = Math.min(
    100,
    40 +
      (profile.emailVerified ? 15 : 0) +
      (profile.phoneVerified ? 15 : 0) +
      (driverVerified ? 25 : 0)
  );

  const trustLevel =
    trustScore >= 85 ? "Premium" : trustScore >= 65 ? "Trusted" : "Basic";

  async function handleSignOut() {
    await signOut(auth);
    window.location.href = "/login";
  }

  return (
    <main className="page">
      <section className="profileCard">
        <div className="topGlow" />

        {displayPhoto ? (
          <img src={displayPhoto} alt={displayName} className="avatarImage" />
        ) : (
          <div className="avatar">{avatar}</div>
        )}

        <p className="eyebrow">RoadLink Premium Profile</p>
        <h1>{displayName}</h1>
        <p className="email">{displayEmail}</p>

        <div className="badges">
          <span className="good">✓ Email Verified</span>
          <span className="role">{profile.role || "member"}</span>
          <span className="good">{trustLevel} Trust</span>
          <span className={driverVerified ? "good" : "bad"}>
            {driverVerified ? "✓ Verified Driver" : "Driver Not Verified"}
          </span>
        </div>

        {message && <p className="message">{message}</p>}
      </section>

      <section className="trustCard">
        <div>
          <p className="eyebrow">Trust Score</p>
          <h2>{trustScore}/100</h2>
        </div>

        <div className="bar">
          <div style={{ width: `${trustScore}%` }} />
        </div>
      </section>

      <section className="menu">
        <ProfileLink href="/profile/edit" icon="📝" title="Edit Profile" text="Update photo, name, bio, city and state." />
        <ProfileLink href="/driver-verification" icon="🛡️" title="Driver Verification" text="View or update your verification documents." />
        <ProfileLink href="/dashboard/driver" icon="🚗" title="Driver Dashboard" text="Manage rides, passengers and earnings." />
        <ProfileLink href="/my-rides" icon="🚘" title="My Rides" text="View the rides you have published." />
        <ProfileLink href="/my-bookings" icon="🎟️" title="My Bookings" text="View your passenger reservations." />
        <ProfileLink href="/reviews" icon="⭐" title="Ratings & Reviews" text="See your public reputation on RoadLink." />
        <ProfileLink href="/notifications" icon="🔔" title="Notifications" text="Review alerts and account updates." />
        <ProfileLink href="/messages" icon="💬" title="Messages" text="Open your RoadLink inbox." />
      </section>

      <button onClick={handleSignOut} className="signOutButton">
        Sign Out
      </button>

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
          padding: 20px;
          padding-bottom: 110px;
          font-family: Arial, sans-serif;
        }

        .profileCard,
        .trustCard,
        .menu,
        .signOutButton {
          max-width: 760px;
          margin-left: auto;
          margin-right: auto;
        }

        .profileCard,
        .trustCard,
        .menuLink {
          background: rgba(8, 13, 25, 0.92);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 24px 80px rgba(0,0,0,0.55);
          backdrop-filter: blur(16px);
        }

        .profileCard {
          position: relative;
          overflow: hidden;
          border-radius: 34px;
          padding: 32px;
          text-align: center;
          margin-bottom: 18px;
        }

        .topGlow {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at top, rgba(34,197,94,0.18), transparent 45%);
          pointer-events: none;
        }

        .avatar,
        .avatarImage {
          position: relative;
          width: 118px;
          height: 118px;
          border-radius: 50%;
          margin: 0 auto 18px;
          border: 2px solid rgba(34,197,94,0.5);
          box-shadow: 0 18px 60px rgba(34,197,94,0.35);
        }

        .avatar {
          background: linear-gradient(135deg, #22c55e, #16a34a);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 50px;
          font-weight: 900;
        }

        .avatarImage {
          object-fit: cover;
        }

        .eyebrow {
          position: relative;
          margin: 0 0 10px;
          color: #22c55e;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        h1 {
          position: relative;
          font-size: 44px;
          line-height: 1;
          margin: 0 0 12px;
          letter-spacing: -1px;
        }

        .email {
          position: relative;
          color: #a1a1aa;
          font-size: 17px;
          overflow-wrap: anywhere;
          margin: 0;
        }

        .badges {
          position: relative;
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 10px;
          margin-top: 20px;
        }

        .badges span {
          padding: 10px 14px;
          border-radius: 999px;
          font-weight: 900;
          text-transform: capitalize;
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
          position: relative;
          color: #22c55e;
          font-weight: 900;
          margin-top: 16px;
        }

        .trustCard {
          border-radius: 28px;
          padding: 24px;
          margin-bottom: 18px;
          background: rgba(8, 13, 25, 0.92);
          border: 1px solid rgba(255,255,255,0.12);
        }

        .trustCard h2 {
          color: #22c55e;
          font-size: 38px;
          margin: 0 0 14px;
        }

        .bar {
          width: 100%;
          height: 14px;
          border-radius: 999px;
          background: rgba(255,255,255,0.08);
          overflow: hidden;
        }

        .bar div {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(135deg, #22c55e, #16a34a);
        }

        .menu {
          display: grid;
          gap: 12px;
          margin-bottom: 18px;
        }

        .menuLink {
          display: grid;
          grid-template-columns: 54px 1fr auto;
          gap: 14px;
          align-items: center;
          padding: 18px;
          border-radius: 22px;
          color: white;
          text-decoration: none;
        }

        .menuIcon {
          width: 54px;
          height: 54px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(34,197,94,0.13);
          border: 1px solid rgba(34,197,94,0.35);
          font-size: 26px;
        }

        .menuText strong {
          display: block;
          font-size: 18px;
          margin-bottom: 5px;
        }

        .menuText span {
          display: block;
          color: #a1a1aa;
          font-size: 14px;
          line-height: 1.4;
        }

        .arrow {
          color: #22c55e;
          font-size: 24px;
          font-weight: 900;
        }

        .signOutButton {
          display: block;
          width: 100%;
          padding: 18px;
          border-radius: 999px;
          border: none;
          background: linear-gradient(135deg, #ef4444, #b91c1c);
          color: white;
          font-size: 17px;
          font-weight: 900;
          cursor: pointer;
        }

        @media (max-width: 700px) {
          .page {
            padding: 16px;
            padding-bottom: 110px;
          }

          .profileCard {
            padding: 28px 22px;
          }

          h1 {
            font-size: 38px;
          }

          .menuLink {
            grid-template-columns: 48px 1fr auto;
            padding: 16px;
          }

          .menuIcon {
            width: 48px;
            height: 48px;
            font-size: 23px;
          }
        }
      `}</style>
    </main>
  );
}

function ProfileLink({
  href,
  icon,
  title,
  text,
}: {
  href: string;
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <Link href={href} className="menuLink">
      <div className="menuIcon">{icon}</div>

      <div className="menuText">
        <strong>{title}</strong>
        <span>{text}</span>
      </div>

      <div className="arrow">›</div>
    </Link>
  );
}
