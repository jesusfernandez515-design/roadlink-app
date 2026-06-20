"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type ReferralStatus = "champion" | "active" | "starter" | "inactive";

type BasicItem = {
  id: string;
  name?: string;
  email?: string;
  status?: string;
  amount?: number;
  price?: number;
  seatsBooked?: number;
  passengerId?: string;
  passengerEmail?: string;
  driverId?: string;
  driverEmail?: string;
  referredBy?: string;
  referredByEmail?: string;
  referralCode?: string;
  createdAt?: string;
};

type ReferralProfile = {
  id: string;
  userId: string;
  name: string;
  email: string;
  referralCode: string;
  referrals: number;
  completedReferrals: number;
  referralRevenue: number;
  rewardAmount: number;
  conversionRate: number;
  referralScore: number;
  status: ReferralStatus;
  insight: string;
};

export default function AdminReferralCenterPage() {
  const [users, setUsers] = useState<BasicItem[]>([]);
  const [bookings, setBookings] = useState<BasicItem[]>([]);
  const [selected, setSelected] = useState<ReferralProfile | null>(null);
  const [filter, setFilter] = useState<"all" | ReferralStatus>("all");
  const [message, setMessage] = useState("Loading referral center...");
  const [savingId, setSavingId] = useState("");

  useEffect(() => {
    const listen = <T,>(name: string, setter: (items: T[]) => void) =>
      onSnapshot(
        query(collection(db, name)),
        (snapshot) => {
          setter(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as T[]);
          setMessage("");
        },
        () => setter([])
      );

    const unsubUsers = listen<BasicItem>("users", setUsers);
    const unsubBookings = listen<BasicItem>("bookings", setBookings);

    return () => {
      unsubUsers();
      unsubBookings();
    };
  }, []);

  const referralProfiles = useMemo<ReferralProfile[]>(() => {
    return users
      .map((user) => {
        const code = user.referralCode || user.email?.split("@")[0] || user.id.slice(0, 6);

        const referredUsers = users.filter(
          (item) =>
            item.referredBy === user.id ||
            item.referredByEmail === user.email ||
            item.referredBy === code
        );

        const referredEmails = referredUsers.map((item) => item.email).filter(Boolean);

        const referralBookings = bookings.filter(
          (booking) =>
            referredUsers.some(
              (person) =>
                person.id === booking.passengerId ||
                person.email === booking.passengerEmail ||
                person.id === booking.driverId ||
                person.email === booking.driverEmail
            ) || referredEmails.includes(booking.passengerEmail || "")
        );

        const completedReferralBookings = referralBookings.filter(
          (booking) => booking.status === "completed"
        );

        const referralRevenue = completedReferralBookings.reduce(
          (total, booking) =>
            total +
            Number(booking.price || booking.amount || 0) *
              Number(booking.seatsBooked || 1),
          0
        );

        const referrals = referredUsers.length;
        const completedReferrals = new Set(
          completedReferralBookings
            .map((booking) => booking.passengerEmail || booking.driverEmail || booking.passengerId || booking.driverId)
            .filter(Boolean)
        ).size;

        const conversionRate =
          referrals > 0 ? Math.round((completedReferrals / referrals) * 100) : 0;

        let referralScore = 0;

        referralScore += referrals * 15;
        referralScore += completedReferrals * 20;
        referralScore += referralRevenue >= 1000 ? 20 : referralRevenue >= 250 ? 12 : referralRevenue > 0 ? 6 : 0;
        referralScore += conversionRate >= 50 ? 15 : conversionRate >= 25 ? 8 : 0;

        referralScore = Math.max(Math.min(referralScore, 100), 0);

        const status: ReferralStatus =
          referralScore >= 85
            ? "champion"
            : referralScore >= 55
            ? "active"
            : referralScore >= 20
            ? "starter"
            : "inactive";

        const rewardAmount =
          status === "champion"
            ? Math.max(25, Math.round(referralRevenue * 0.06))
            : status === "active"
            ? Math.max(10, Math.round(referralRevenue * 0.04))
            : status === "starter"
            ? Math.max(5, Math.round(referralRevenue * 0.02))
            : 0;

        const insight =
          status === "champion"
            ? "Top referral champion. Strong word-of-mouth growth."
            : status === "active"
            ? "Active referrer. Good candidate for referral bonuses."
            : status === "starter"
            ? "Early referral activity. Encourage sharing with coupons."
            : "Inactive referral profile. No meaningful referrals yet.";

        return {
          id: user.id,
          userId: user.id,
          name: user.name || "RoadLink User",
          email: user.email || "No email",
          referralCode: code,
          referrals,
          completedReferrals,
          referralRevenue,
          rewardAmount,
          conversionRate,
          referralScore,
          status,
          insight,
        };
      })
      .sort(
        (a, b) =>
          b.referralScore + b.referralRevenue / 100 - (a.referralScore + a.referralRevenue / 100)
      );
  }, [users, bookings]);

  const filteredProfiles = useMemo(() => {
    if (filter === "all") return referralProfiles;
    return referralProfiles.filter((item) => item.status === filter);
  }, [referralProfiles, filter]);

  useEffect(() => {
    setSelected((current) => {
      if (filteredProfiles.length === 0) return null;
      if (!current) return filteredProfiles[0];
      return filteredProfiles.find((item) => item.id === current.id) || filteredProfiles[0];
    });
  }, [filteredProfiles]);

  const champions = referralProfiles.filter((item) => item.status === "champion").length;
  const active = referralProfiles.filter((item) => item.status === "active").length;
  const starters = referralProfiles.filter((item) => item.status === "starter").length;
  const totalReferrals = referralProfiles.reduce((total, item) => total + item.referrals, 0);
  const totalRewards = referralProfiles.reduce((total, item) => total + item.rewardAmount, 0);
  const totalReferralRevenue = referralProfiles.reduce((total, item) => total + item.referralRevenue, 0);

  async function saveReferral(profile: ReferralProfile) {
    try {
      setSavingId(profile.id);
      setMessage("");

      const now = new Date().toISOString();

      await setDoc(
        doc(db, "referralProfiles", profile.id),
        {
          ...profile,
          savedAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "notifications", `referral-${profile.id}-${Date.now()}`),
        {
          userId: profile.userId,
          type: "referral_update",
          title: "Referral Rewards Update",
          message:
            profile.rewardAmount > 0
              ? `You may qualify for a referral reward of $${profile.rewardAmount}.`
              : "Share your RoadLink referral code to earn rewards.",
          read: false,
          actionUrl: "/profile",
          createdAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `referral-${profile.id}-${Date.now()}`),
        {
          userId: profile.userId,
          userEmail: profile.email,
          action: "Referral Profile Saved",
          targetId: profile.id,
          targetType: "referralProfile",
          details: `${profile.referrals} referrals, reward $${profile.rewardAmount}`,
          severity: profile.status === "champion" ? "success" : "info",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage("Referral profile saved.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not save referral profile.");
    } finally {
      setSavingId("");
    }
  }

  function money(value: number) {
    return `$${Math.round(value).toLocaleString()}`;
  }

  function statusLabel(status: ReferralStatus) {
    if (status === "champion") return "Champion";
    if (status === "active") return "Active";
    if (status === "starter") return "Starter";
    return "Inactive";
  }

  function shortText(value?: string, max = 44) {
    if (!value) return "Not available";
    if (value.length <= max) return value;
    return `${value.slice(0, max)}...`;
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/loyalty" className="miniButton">Loyalty</Link>
          <Link href="/admin/growth-intelligence" className="miniButton">Growth</Link>
          <Link href="/admin/coupons" className="miniButton">Coupons</Link>
          <Link href="/admin/marketing" className="miniButton">Marketing</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Growth Engine</p>
            <h1>Referral <span>Center</span></h1>
            <p className="subtitle">
              Track referral codes, invited users, completed referrals, referral revenue,
              conversion rates, growth rewards and word-of-mouth performance.
            </p>
          </div>

          <div className={totalReferrals > 0 ? "scoreOrb" : "scoreOrb warningScore"}>
            <strong>{totalReferrals}</strong>
            <span>Referrals</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="🏆" label="Champions" value={String(champions)} />
          <Metric icon="✅" label="Active" value={String(active)} />
          <Metric icon="🌱" label="Starters" value={String(starters)} />
          <Metric icon="👥" label="Total Referrals" value={String(totalReferrals)} />
          <Metric icon="💰" label="Referral Revenue" value={money(totalReferralRevenue)} />
          <Metric icon="🎁" label="Referral Rewards" value={money(totalRewards)} />
        </section>

        <section className="filters">
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as "all" | ReferralStatus)}
          >
            <option value="all">All referrers</option>
            <option value="champion">Champion</option>
            <option value="active">Active</option>
            <option value="starter">Starter</option>
            <option value="inactive">Inactive</option>
          </select>
        </section>

        <section className="adminGrid">
          <section className="referralCard">
            <p className="eyebrow">Referral Board</p>
            <h2>Referral Profiles</h2>

            {filteredProfiles.length === 0 ? (
              <div className="empty">
                <h3>No referral data found</h3>
                <p>Referral profiles will appear after invited users exist.</p>
              </div>
            ) : (
              <div className="referralList">
                {filteredProfiles.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelected(item)}
                    className={selected?.id === item.id ? "referralRow activeReferral" : "referralRow"}
                  >
                    <div className={`referralIcon ${item.status}`}>
                      {item.status === "champion"
                        ? "🏆"
                        : item.status === "active"
                        ? "✅"
                        : item.status === "starter"
                        ? "🌱"
                        : "💤"}
                    </div>

                    <div className="referralInfo">
                      <strong>{shortText(item.name)}</strong>
                      <span>{shortText(item.email)}</span>
                      <small>{item.referrals} referrals • {money(item.rewardAmount)} reward</small>
                    </div>

                    <em className={`status ${item.status}`}>
                      {statusLabel(item.status)}
                    </em>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="detailsCard">
            {selected ? (
              <>
                <div className="sectionHeader">
                  <div>
                    <p className="eyebrow">Selected Referrer</p>
                    <h2>{shortText(selected.name, 54)}</h2>
                    <p className="email">{selected.email}</p>
                  </div>

                  <span className={`statusPill ${selected.status}`}>
                    {statusLabel(selected.status)}
                  </span>
                </div>

                <div className={`insightBox ${selected.status}`}>
                  <span>Referral Score</span>
                  <strong>{selected.referralScore}/100</strong>
                  <p>{selected.insight}</p>
                </div>

                <div className="scoreBar">
                  <div style={{ width: `${selected.referralScore}%` }} />
                </div>

                <div className="infoGrid">
                  <Info label="Referral Code" value={selected.referralCode} />
                  <Info label="Referral Score" value={`${selected.referralScore}/100`} />
                  <Info label="Status" value={statusLabel(selected.status)} />
                  <Info label="Referrals" value={String(selected.referrals)} />
                  <Info label="Completed Referrals" value={String(selected.completedReferrals)} />
                  <Info label="Conversion Rate" value={`${selected.conversionRate}%`} />
                  <Info label="Referral Revenue" value={money(selected.referralRevenue)} />
                  <Info label="Reward Amount" value={money(selected.rewardAmount)} />
                  <Info label="User ID" value={selected.userId} />
                  <Info label="Email" value={selected.email} />
                </div>

                <section className="summaryBox">
                  <p className="eyebrow">Referral Recommendation</p>
                  <h2>
                    {selected.status === "champion"
                      ? "Pay champion reward"
                      : selected.status === "active"
                      ? "Boost with bonus"
                      : selected.status === "starter"
                      ? "Send referral coupon"
                      : "Activate referral sharing"}
                  </h2>
                  <p>{selected.insight}</p>
                </section>

                <div className="actionRow">
                  <button
                    className="saveButton"
                    onClick={() => saveReferral(selected)}
                    disabled={savingId === selected.id}
                  >
                    Save Referral
                  </button>

                  <Link href="/admin/loyalty" className="linkButton">Loyalty</Link>
                  <Link href="/admin/coupons" className="linkButton">Coupons</Link>
                  <Link href="/admin/growth-intelligence" className="dangerButton">Growth</Link>
                </div>
              </>
            ) : (
              <div className="empty">
                <h3>Select referrer</h3>
                <p>Choose a user to view referral details.</p>
              </div>
            )}
          </section>
        </section>
      </section>

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          color: white;
          padding: 24px;
          padding-bottom: 140px;
          font-family: Arial, sans-serif;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.2), transparent 34%),
            radial-gradient(circle at bottom left, rgba(59,130,246,0.12), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
        }

        .container { max-width: 1280px; margin: auto; }

        .topNav { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 24px; }

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
        .filters,
        .referralCard,
        .detailsCard {
          background: rgba(8,13,25,0.92);
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

        h1 { font-size: 58px; line-height: 1; margin: 0 0 16px; }
        h1 span, h2, .metricValue { color: #22c55e; }
        h2 { font-size: 30px; margin: 0 0 14px; }

        .subtitle,
        .email,
        .empty p,
        .insightBox p,
        .summaryBox p {
          color: #a1a1aa;
          line-height: 1.5;
          overflow-wrap: anywhere;
        }

        .scoreOrb {
          min-width: 110px;
          height: 110px;
          border-radius: 50%;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          text-align: center;
          padding: 10px;
        }

        .warningScore { background: rgba(239,68,68,0.12); border-color: rgba(239,68,68,0.35); }
        .scoreOrb strong { color: #22c55e; font-size: 30px; font-weight: 900; }
        .warningScore strong { color: #fca5a5; }
        .scoreOrb span { color: #a1a1aa; font-size: 10px; font-weight: 900; }

        .message { color: #22c55e; font-weight: 900; margin: 16px 0; }

        .stats {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 14px;
          margin-bottom: 18px;
        }

        .metric { border-radius: 24px; padding: 18px; }

        .metricIcon {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          margin-bottom: 12px;
        }

        .metricLabel {
          display: block;
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .metricValue { font-size: 22px; font-weight: 900; overflow-wrap: anywhere; }

        .filters {
          display: grid;
          grid-template-columns: 230px;
          gap: 12px;
          border-radius: 24px;
          padding: 18px;
          margin-bottom: 24px;
        }

        select {
          width: 100%;
          padding: 15px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
          color: white;
          font-size: 16px;
          outline: none;
        }

        select option { color: black; }

        .adminGrid {
          display: grid;
          grid-template-columns: 0.95fr 1.45fr;
          gap: 24px;
        }

        .referralCard,
        .detailsCard {
          border-radius: 30px;
          padding: 28px;
          overflow: hidden;
        }

        .referralList {
          display: grid;
          gap: 12px;
          max-height: 760px;
          overflow: auto;
          padding-right: 4px;
        }

        .referralRow {
          width: 100%;
          display: grid;
          grid-template-columns: 52px 1fr auto;
          gap: 12px;
          align-items: center;
          padding: 14px;
          border-radius: 18px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          color: white;
          cursor: pointer;
          text-align: left;
        }

        .activeReferral { border-color: rgba(34,197,94,0.45); background: rgba(34,197,94,0.1); }

        .referralIcon {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          border: 1px solid rgba(34,197,94,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }

        .referralIcon.inactive { background: rgba(239,68,68,0.13); border-color: rgba(239,68,68,0.35); }

        .referralInfo { min-width: 0; }

        .referralInfo strong,
        .referralInfo span,
        .referralInfo small {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .referralInfo span,
        .referralInfo small {
          color: #a1a1aa;
          margin-top: 4px;
        }

        .status,
        .statusPill {
          border-radius: 999px;
          padding: 8px 11px;
          font-style: normal;
          font-weight: 900;
          font-size: 12px;
          white-space: nowrap;
        }

        .status.champion,
        .status.active,
        .status.starter,
        .statusPill.champion,
        .statusPill.active,
        .statusPill.starter {
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .status.inactive,
        .statusPill.inactive {
          color: #fca5a5;
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.35);
        }

        .sectionHeader {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 20px;
        }

        .insightBox,
        .summaryBox {
          padding: 22px;
          border-radius: 22px;
          margin-bottom: 20px;
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .insightBox.inactive {
          background: rgba(239,68,68,0.1);
          border-color: rgba(239,68,68,0.35);
        }

        .insightBox span {
          display: block;
          color: #a1a1aa;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .insightBox strong {
          color: #22c55e;
          font-size: 42px;
          font-weight: 900;
        }

        .insightBox.inactive strong { color: #fca5a5; }

        .scoreBar {
          width: 100%;
          height: 18px;
          border-radius: 999px;
          background: rgba(255,255,255,0.08);
          overflow: hidden;
          margin-bottom: 20px;
        }

        .scoreBar div {
          height: 100%;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          border-radius: 999px;
        }

        .infoGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        }

        .infoBox {
          padding: 14px;
          border-radius: 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .infoBox span {
          display: block;
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 6px;
        }

        .infoBox strong { display: block; overflow-wrap: anywhere; }

        .actionRow {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
        }

        .saveButton,
        .linkButton,
        .dangerButton {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 15px;
          border-radius: 999px;
          border: none;
          color: white;
          font-weight: 900;
          cursor: pointer;
          text-decoration: none;
          text-align: center;
        }

        .saveButton { background: linear-gradient(135deg, #22c55e, #16a34a); }
        .linkButton { background: rgba(59,130,246,0.13); border: 1px solid rgba(59,130,246,0.35); }
        .dangerButton { background: linear-gradient(135deg, #ef4444, #991b1b); }

        button:disabled { opacity: 0.6; cursor: not-allowed; }

        .empty {
          padding: 24px;
          border-radius: 22px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          margin-bottom: 16px;
        }

        .empty h3 { margin: 0 0 8px; font-size: 22px; }

        @media (max-width: 1100px) {
          .stats { grid-template-columns: repeat(3, 1fr); }
          .adminGrid { grid-template-columns: 1fr; }
        }

        @media (max-width: 720px) {
          .page { padding: 16px; padding-bottom: 140px; }

          .hero {
            flex-direction: column;
            align-items: flex-start;
            padding: 28px;
          }

          h1 { font-size: 44px; }

          .stats,
          .filters,
          .infoGrid,
          .actionRow {
            grid-template-columns: 1fr;
          }

          .referralRow {
            grid-template-columns: 46px 1fr;
          }

          .referralRow .status {
            grid-column: 1 / -1;
            width: fit-content;
          }

          .referralIcon {
            width: 46px;
            height: 46px;
          }

          .sectionHeader { flex-direction: column; }
        }
      `}</style>
    </main>
  );
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="infoBox">
      <span>{label}</span>
      <strong>{value || "Not available"}</strong>
    </div>
  );
                                           }
