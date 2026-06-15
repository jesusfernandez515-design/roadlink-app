"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
  where,
} from "firebase/firestore";

type UserProfile = {
  id?: string;
  name?: string;
  email?: string;
  referralCode?: string;
  referredBy?: string;
  referralCredits?: number;
  createdAt?: string;
};

type ReferralRecord = {
  id: string;
  referrerId?: string;
  referrerEmail?: string;
  referredUserId?: string;
  referredUserEmail?: string;
  referralCode?: string;
  status?: string;
  creditAmount?: number;
  createdAt?: string;
};

export default function ReferralsPage() {
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [profile, setProfile] = useState<UserProfile>({});
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [message, setMessage] = useState("Loading referrals...");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;
    let unsubscribeReferrals: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setUserId("");
        setUserEmail("");
        setProfile({});
        setReferrals([]);
        setMessage("Please sign in to view referrals.");
        return;
      }

      setUserId(user.uid);
      setUserEmail(user.email || "");

      const userRef = doc(db, "users", user.uid);

      await setDoc(
        userRef,
        {
          email: user.email || "",
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      unsubscribeProfile = onSnapshot(
        userRef,
        async (snapshot) => {
          const data = snapshot.data() as UserProfile | undefined;

          if (!data?.referralCode) {
            const code = createReferralCode(user.email || user.uid);

            await setDoc(
              userRef,
              {
                referralCode: code,
                referralCredits: Number(data?.referralCredits || 0),
                updatedAt: new Date().toISOString(),
              },
              { merge: true }
            );

            setProfile({
              id: user.uid,
              ...data,
              referralCode: code,
            });
          } else {
            setProfile({
              id: user.uid,
              ...data,
            });
          }

          setMessage("");
        },
        (error) => setMessage(error.message)
      );

      unsubscribeReferrals = onSnapshot(
        query(collection(db, "referrals"), where("referrerId", "==", user.uid)),
        (snapshot) => {
          const data = snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          })) as ReferralRecord[];

          data.sort((a, b) =>
            String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
          );

          setReferrals(data);
        },
        (error) => setMessage(error.message)
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeReferrals) unsubscribeReferrals();
    };
  }, []);

  const referralCode = profile.referralCode || "";
  const referralLink = referralCode
    ? `https://www.getroadlink.com/register?ref=${referralCode}`
    : "Generating referral link...";

  const totalCredits = Number(profile.referralCredits || 0);
  const completedReferrals = referrals.filter((item) => item.status === "completed").length;
  const pendingReferrals = referrals.filter((item) => item.status !== "completed").length;

  const shareText = useMemo(() => {
    return `Join RoadLink with my referral link: ${referralLink}`;
  }, [referralLink]);

  async function copyReferralLink() {
    try {
      setSaving(true);
      setMessage("");

      await navigator.clipboard.writeText(referralLink);

      setMessage("Referral link copied.");
    } catch {
      setMessage("Could not copy link. Please copy it manually.");
    } finally {
      setSaving(false);
    }
  }

  async function shareReferralLink() {
    try {
      setSaving(true);
      setMessage("");

      if (navigator.share) {
        await navigator.share({
          title: "Join RoadLink",
          text: shareText,
          url: referralLink,
        });

        setMessage("Referral link shared.");
      } else {
        await copyReferralLink();
      }
    } catch {
      setMessage("Share cancelled.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/dashboard" className="miniButton">Dashboard</Link>
          <Link href="/profile" className="miniButton">Profile</Link>
          <Link href="/wallet" className="miniButton">Wallet</Link>
          <Link href="/notifications" className="miniButton">Notifications</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Growth</p>
            <h1>Referral <span>Program</span></h1>
            <p className="subtitle">
              Invite friends to RoadLink, grow the community, and earn future ride credits.
            </p>
          </div>

          <div className="heroIcon">🎁</div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="👥" label="Total Invites" value={String(referrals.length)} />
          <Metric icon="⏳" label="Pending" value={String(pendingReferrals)} />
          <Metric icon="✅" label="Completed" value={String(completedReferrals)} />
          <Metric icon="💵" label="Credits" value={`$${totalCredits}`} />
        </section>

        <section className="referralCard">
          <p className="eyebrow">Your Code</p>
          <h2>{referralCode || "Generating..."}</h2>

          <div className="linkBox">
            <span>{referralLink}</span>
          </div>

          <div className="actionRow">
            <button onClick={copyReferralLink} disabled={saving}>
              {saving ? "Working..." : "Copy Link"}
            </button>

            <button onClick={shareReferralLink} disabled={saving}>
              Share Invite
            </button>
          </div>
        </section>

        <section className="howItWorks">
          <p className="eyebrow">How It Works</p>
          <h2>Grow RoadLink faster</h2>

          <div className="steps">
            <Step icon="1️⃣" title="Share your link" text="Send your RoadLink invite to friends, drivers, passengers, coworkers, or students." />
            <Step icon="2️⃣" title="Friend joins" text="When someone registers with your referral code, RoadLink tracks the invite." />
            <Step icon="3️⃣" title="Earn credit" text="Referral credits can later be used for promotions, rides, or RoadLink rewards." />
          </div>
        </section>

        <section className="history">
          <p className="eyebrow">Referral History</p>
          <h2>Your Invites</h2>

          {referrals.length === 0 ? (
            <div className="empty">
              <h3>No referrals yet</h3>
              <p>Share your link to start inviting people to RoadLink.</p>
            </div>
          ) : (
            <div className="referralList">
              {referrals.map((item) => (
                <div key={item.id} className="referralItem">
                  <div className="referralIcon">👤</div>

                  <div>
                    <strong>{item.referredUserEmail || "New RoadLink User"}</strong>
                    <p>{item.createdAt ? new Date(item.createdAt).toLocaleString() : "Recently"}</p>
                    <small>Status: {item.status || "pending"}</small>
                  </div>

                  <span>${Number(item.creditAmount || 0)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </section>

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.22), transparent 34%),
            radial-gradient(circle at bottom left, rgba(16,185,129,0.12), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          padding: 24px;
          padding-bottom: 140px;
          font-family: Arial, sans-serif;
        }

        .container {
          max-width: 960px;
          margin: auto;
        }

        .topNav {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 24px;
        }

        .miniButton {
          padding: 11px 18px;
          border-radius: 999px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
          text-decoration: none;
          font-weight: 900;
        }

        .hero,
        .metric,
        .referralCard,
        .howItWorks,
        .history {
          background: rgba(8, 13, 25, 0.92);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 24px 80px rgba(0,0,0,0.55);
          backdrop-filter: blur(16px);
        }

        .hero {
          border-radius: 34px;
          padding: 34px;
          margin-bottom: 22px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 24px;
        }

        .eyebrow {
          margin: 0 0 10px;
          color: #22c55e;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        h1 {
          font-size: 58px;
          line-height: 1;
          margin: 0 0 16px;
        }

        h1 span,
        h2,
        .metricValue,
        .referralCard h2 {
          color: #22c55e;
        }

        h2 {
          font-size: 32px;
          margin: 0 0 18px;
        }

        .subtitle {
          color: #a1a1aa;
          line-height: 1.5;
          margin: 0;
        }

        .heroIcon {
          min-width: 92px;
          height: 92px;
          border-radius: 50%;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 42px;
        }

        .message {
          color: #22c55e;
          font-weight: 900;
          margin: 16px 0;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-bottom: 22px;
        }

        .metric {
          border-radius: 24px;
          padding: 22px;
        }

        .metricIcon {
          width: 46px;
          height: 46px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          margin-bottom: 14px;
        }

        .metricLabel {
          display: block;
          color: #a1a1aa;
          font-size: 13px;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .metricValue {
          font-size: 30px;
          font-weight: 900;
        }

        .referralCard,
        .howItWorks,
        .history {
          border-radius: 30px;
          padding: 28px;
          margin-bottom: 22px;
        }

        .referralCard h2 {
          font-size: 46px;
          letter-spacing: 2px;
          margin-bottom: 18px;
        }

        .linkBox {
          padding: 18px;
          border-radius: 18px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.12);
          margin-bottom: 18px;
          overflow-wrap: anywhere;
        }

        .linkBox span {
          color: #d4d4d8;
          font-weight: 900;
        }

        .actionRow {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .actionRow button {
          padding: 17px;
          border-radius: 999px;
          border: none;
          color: white;
          font-weight: 900;
          cursor: pointer;
          background: linear-gradient(135deg, #22c55e, #16a34a);
        }

        .actionRow button:nth-child(2) {
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .steps {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
        }

        .step {
          padding: 18px;
          border-radius: 20px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .stepIcon {
          font-size: 28px;
          margin-bottom: 12px;
        }

        .step h3 {
          margin: 0 0 8px;
        }

        .step p,
        .empty p,
        .referralItem p,
        .referralItem small {
          color: #a1a1aa;
          line-height: 1.5;
        }

        .referralList {
          display: grid;
          gap: 12px;
        }

        .referralItem {
          display: grid;
          grid-template-columns: 50px 1fr auto;
          gap: 14px;
          align-items: center;
          padding: 16px;
          border-radius: 20px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .referralIcon {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }

        .referralItem strong {
          display: block;
          overflow-wrap: anywhere;
        }

        .referralItem p,
        .referralItem small {
          margin: 0;
        }

        .referralItem span {
          color: #22c55e;
          font-weight: 900;
          font-size: 20px;
        }

        .empty {
          padding: 24px;
          border-radius: 22px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .empty h3 {
          margin: 0 0 8px;
        }

        @media (max-width: 760px) {
          .page {
            padding: 16px;
            padding-bottom: 140px;
          }

          .hero {
            flex-direction: column;
            align-items: flex-start;
            padding: 28px;
          }

          h1 {
            font-size: 44px;
          }

          .stats,
          .steps,
          .actionRow,
          .referralItem {
            grid-template-columns: 1fr;
          }

          .referralCard,
          .howItWorks,
          .history {
            padding: 24px;
          }

          .referralCard h2 {
            font-size: 34px;
          }
        }
      `}</style>
    </main>
  );
}

function createReferralCode(value: string) {
  const clean = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const base = clean.slice(0, 4) || "ROAD";
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `ROAD-${base}-${random}`;
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="metric">
      <div className="metricIcon">{icon}</div>
      <span className="metricLabel">{label}</span>
      <div className="metricValue">{value}</div>
    </div>
  );
}

function Step({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <div className="step">
      <div className="stepIcon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
