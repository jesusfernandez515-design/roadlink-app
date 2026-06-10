"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";

type UserProfile = {
  name?: string;
  email?: string;
  photoURL?: string;
};

export default function Home() {
  const [profile, setProfile] = useState<UserProfile>({});
  const [avatar, setAvatar] = useState("R");

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setProfile({});
        setAvatar("R");
        return;
      }

      const userEmail = user.email || "";
      setAvatar(userEmail ? userEmail.charAt(0).toUpperCase() : "R");

      unsubscribeProfile = onSnapshot(doc(db, "users", user.uid), (snapshot) => {
        const data = snapshot.data() as UserProfile | undefined;

        setProfile({
          name: data?.name || user.displayName || "RoadLink User",
          email: data?.email || userEmail,
          photoURL: data?.photoURL || user.photoURL || "",
        });
      });
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const displayName = profile.name || "RoadLink User";
  const displayEmail = profile.email || "No email found";
  const displayPhoto = profile.photoURL || "";

  return (
    <main className="page">
      <section className="homeCard">
        <div className="heroTop">
          {displayPhoto ? (
            <img src={displayPhoto} alt={displayName} className="avatarImage" />
          ) : (
            <div className="avatar">{avatar}</div>
          )}

          <div className="heroText">
            <p className="eyebrow">RoadLink Dashboard</p>
            <h1>Welcome back, {displayName}</h1>
            <p className="email">{displayEmail}</p>
          </div>
        </div>

        <div className="actions">
          <Link href="/find-ride">🔎 Find Ride</Link>
          <Link href="/offer-ride">➕ Offer Ride</Link>
        </div>
      </section>

      <section className="stats">
        <Card icon="🚗" title="Active Rides" value="3" />
        <Card icon="🎟️" title="Bookings" value="0" />
        <Card icon="💬" title="Messages" value="0" />
        <Card icon="🔔" title="Notifications" value="0" alert />
        <Card icon="✅" title="Completed Trips" value="1" />
        <Card icon="💰" title="Earnings" value="$80" />
      </section>

      <section className="sectionCard">
        <p className="eyebrow">Next Reservation</p>
        <h2>Upcoming Trip</h2>
        <div className="emptyBox">
          <strong>No upcoming trips yet.</strong>
          <p>Reserve your next ride and your trip summary will appear here.</p>
          <Link href="/find-ride">Find a Ride</Link>
        </div>
      </section>

      <style>{`
        * {
          box-sizing: border-box;
        }

        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.2), transparent 34%),
            radial-gradient(circle at bottom left, rgba(16,185,129,0.12), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          padding: 16px;
          padding-bottom: 110px;
          font-family: Arial, sans-serif;
        }

        .homeCard,
        .stats,
        .sectionCard {
          max-width: 860px;
          margin-left: auto;
          margin-right: auto;
        }

        .homeCard,
        .card,
        .sectionCard,
        .emptyBox {
          background: rgba(8, 13, 25, 0.92);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 18px 60px rgba(0,0,0,0.45);
          backdrop-filter: blur(16px);
        }

        .homeCard {
          border-radius: 28px;
          padding: 22px;
          margin-bottom: 14px;
        }

        .heroTop {
          display: grid;
          grid-template-columns: 90px 1fr;
          gap: 14px;
          align-items: center;
        }

        .avatar,
        .avatarImage {
          width: 90px;
          height: 90px;
          border-radius: 50%;
          border: 2px solid rgba(34,197,94,0.55);
        }

        .avatar {
          background: linear-gradient(135deg, #22c55e, #16a34a);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 36px;
          font-weight: 900;
        }

        .avatarImage {
          object-fit: cover;
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
          font-size: 32px;
          line-height: 1.05;
          margin: 0 0 8px;
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
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 20px;
        }

        .actions a,
        .emptyBox a {
          padding: 14px;
          border-radius: 999px;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          text-align: center;
          text-decoration: none;
          font-weight: 900;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          margin-bottom: 14px;
        }

        .card {
          border-radius: 20px;
          padding: 16px;
          min-height: 120px;
        }

        .card.alert {
          background: rgba(127,29,29,0.28);
          border-color: rgba(239,68,68,0.3);
        }

        .cardIcon {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 18px;
        }

        .card span {
          display: block;
          color: #a1a1aa;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .card strong {
          color: #22c55e;
          font-size: 28px;
        }

        .sectionCard {
          border-radius: 24px;
          padding: 20px;
          margin-bottom: 14px;
        }

        .emptyBox {
          border-radius: 18px;
          padding: 16px;
          display: grid;
          gap: 10px;
        }

        .emptyBox p {
          color: #a1a1aa;
          margin: 0;
          line-height: 1.4;
        }

        @media (max-width: 380px) {
          .heroTop {
            grid-template-columns: 76px 1fr;
          }

          .avatar,
          .avatarImage {
            width: 76px;
            height: 76px;
          }

          h1 {
            font-size: 26px;
          }
        }
      `}</style>
    </main>
  );
}

function Card({
  icon,
  title,
  value,
  alert,
}: {
  icon: string;
  title: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div className={alert ? "card alert" : "card"}>
      <div className="cardIcon">{icon}</div>
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}
