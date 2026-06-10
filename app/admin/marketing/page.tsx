"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type UserItem = {
  id: string;
  email?: string;
  driverVerified?: boolean;
  createdAt?: string;
};

type Coupon = {
  id: string;
  code?: string;
  title?: string;
  active?: boolean;
  usedCount?: number;
  createdAt?: string;
};

type Campaign = {
  id: string;
  title?: string;
  channel?: string;
  status?: string;
  audience?: string;
  budget?: number;
  goal?: string;
  createdAt?: string;
};

export default function AdminMarketingPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [message, setMessage] = useState("Loading marketing dashboard...");
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [channel, setChannel] = useState("facebook");
  const [audience, setAudience] = useState("all");
  const [budget, setBudget] = useState(50);
  const [goal, setGoal] = useState("");

  useEffect(() => {
    const unsubUsers = onSnapshot(
      query(collection(db, "users")),
      (snapshot) => {
        setUsers(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as UserItem[]);
        setMessage("");
      },
      (error) => setMessage(error.message)
    );

    const unsubCoupons = onSnapshot(
      query(collection(db, "coupons")),
      (snapshot) => {
        setCoupons(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Coupon[]);
      },
      (error) => setMessage(error.message)
    );

    const unsubCampaigns = onSnapshot(
      query(collection(db, "marketingCampaigns")),
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Campaign[];

        data.sort((a, b) =>
          String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
        );

        setCampaigns(data);
      },
      (error) => setMessage(error.message)
    );

    return () => {
      unsubUsers();
      unsubCoupons();
      unsubCampaigns();
    };
  }, []);

  const newUsersThisMonth = useMemo(() => {
    const now = new Date();

    return users.filter((user) => {
      if (!user.createdAt) return false;
      const date = new Date(user.createdAt);
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }).length;
  }, [users]);

  const drivers = users.filter((user) => user.driverVerified).length;
  const passengers = users.length - drivers;
  const activeCoupons = coupons.filter((coupon) => coupon.active !== false).length;
  const couponUses = coupons.reduce((total, coupon) => total + Number(coupon.usedCount || 0), 0);
  const activeCampaigns = campaigns.filter((campaign) => campaign.status === "active").length;
  const totalBudget = campaigns.reduce((total, campaign) => total + Number(campaign.budget || 0), 0);

  async function createCampaign() {
    if (!title.trim()) {
      setMessage("Campaign title is required.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      await addDoc(collection(db, "marketingCampaigns"), {
        title: title.trim(),
        channel,
        audience,
        budget: Number(budget || 0),
        goal: goal.trim(),
        status: "active",
        createdAt: new Date().toISOString(),
      });

      setTitle("");
      setChannel("facebook");
      setAudience("all");
      setBudget(50);
      setGoal("");

      setMessage("Marketing campaign created.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not create campaign.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin Home</Link>
          <Link href="/admin/coupons" className="miniButton">Coupons</Link>
          <Link href="/admin/notifications" className="miniButton">Notifications</Link>
          <Link href="/admin/analytics" className="miniButton">Analytics</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Admin</p>
            <h1>Marketing <span>Dashboard</span></h1>
            <p className="subtitle">
              Manage growth campaigns, track users, monitor coupon usage, and prepare
              RoadLink for paid acquisition.
            </p>
          </div>

          <div className="heroIcon">📈</div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="👥" label="Users" value={String(users.length)} />
          <Metric icon="✨" label="New This Month" value={String(newUsersThisMonth)} />
          <Metric icon="🚘" label="Drivers" value={String(drivers)} />
          <Metric icon="🎟️" label="Passengers" value={String(passengers)} />
          <Metric icon="🎁" label="Active Coupons" value={String(activeCoupons)} />
          <Metric icon="🔥" label="Coupon Uses" value={String(couponUses)} />
          <Metric icon="📢" label="Campaigns" value={String(campaigns.length)} />
          <Metric icon="💵" label="Budget" value={`$${totalBudget}`} />
        </section>

        <section className="createCard">
          <p className="eyebrow">Create Campaign</p>
          <h2>New Marketing Campaign</h2>

          <div className="formGrid">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Campaign title"
            />

            <select value={channel} onChange={(event) => setChannel(event.target.value)}>
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
              <option value="tiktok">TikTok</option>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="local">Local Ads</option>
            </select>

            <select value={audience} onChange={(event) => setAudience(event.target.value)}>
              <option value="all">All Users</option>
              <option value="drivers">Drivers</option>
              <option value="passengers">Passengers</option>
              <option value="new_users">New Users</option>
            </select>

            <input
              type="number"
              value={budget}
              onChange={(event) => setBudget(Number(event.target.value))}
              placeholder="Budget"
            />
          </div>

          <textarea
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            placeholder="Campaign goal..."
          />

          <button onClick={createCampaign} disabled={saving} className="createButton">
            {saving ? "Creating..." : "Create Campaign"}
          </button>
        </section>

        <section className="grid">
          <section className="card">
            <p className="eyebrow">Campaigns</p>
            <h2>Active Campaigns</h2>

            {campaigns.length === 0 ? (
              <div className="empty">
                <h3>No campaigns yet</h3>
                <p>Create your first marketing campaign above.</p>
              </div>
            ) : (
              <div className="list">
                {campaigns.map((campaign) => (
                  <div key={campaign.id} className="item">
                    <div className="itemIcon">📢</div>
                    <div className="itemInfo">
                      <strong>{campaign.title || "Campaign"}</strong>
                      <span>{campaign.channel || "channel"} • {campaign.audience || "audience"}</span>
                      <small>{campaign.goal || "No goal set"}</small>
                    </div>
                    <em>${Number(campaign.budget || 0)}</em>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <p className="eyebrow">Coupons</p>
            <h2>Promotion Performance</h2>

            {coupons.length === 0 ? (
              <div className="empty">
                <h3>No coupons yet</h3>
                <p>Create coupons to track promotions here.</p>
              </div>
            ) : (
              <div className="list">
                {coupons.map((coupon) => (
                  <div key={coupon.id} className="item">
                    <div className="itemIcon">🎁</div>
                    <div className="itemInfo">
                      <strong>{coupon.code || "COUPON"}</strong>
                      <span>{coupon.title || "Promotion"}</span>
                      <small>Used {Number(coupon.usedCount || 0)} time(s)</small>
                    </div>
                    <em>{coupon.active === false ? "Off" : "Live"}</em>
                  </div>
                ))}
              </div>
            )}
          </section>
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

        .container { max-width: 1180px; margin: auto; }

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
        .createCard,
        .card {
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

        h1 { font-size: 58px; line-height: 1; margin: 0 0 16px; }

        h1 span,
        h2,
        .metricValue {
          color: #22c55e;
        }

        h2 { font-size: 32px; margin: 0 0 14px; }

        .subtitle,
        .empty p,
        .itemInfo span,
        .itemInfo small {
          color: #a1a1aa;
          line-height: 1.5;
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

        .message { color: #22c55e; font-weight: 900; margin: 16px 0; }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-bottom: 24px;
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

        .metricValue { font-size: 24px; font-weight: 900; }

        .createCard,
        .card {
          border-radius: 30px;
          padding: 28px;
          margin-bottom: 24px;
        }

        .formGrid {
          display: grid;
          grid-template-columns: 1fr 180px 180px 140px;
          gap: 12px;
        }

        input,
        select,
        textarea {
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

        textarea {
          min-height: 110px;
          resize: vertical;
          margin-top: 12px;
        }

        .createButton {
          width: 100%;
          margin-top: 14px;
          padding: 16px;
          border-radius: 999px;
          border: none;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          font-weight: 900;
          cursor: pointer;
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }

        .list { display: grid; gap: 12px; }

        .item {
          display: grid;
          grid-template-columns: 52px 1fr auto;
          gap: 12px;
          align-items: center;
          padding: 14px;
          border-radius: 18px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .itemIcon {
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

        .itemInfo { min-width: 0; }

        .itemInfo strong,
        .itemInfo span,
        .itemInfo small {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .item em {
          color: #22c55e;
          font-style: normal;
          font-weight: 900;
        }

        .empty {
          padding: 26px;
          border-radius: 22px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .empty h3 { margin: 0 0 8px; font-size: 24px; }

        button:disabled { opacity: 0.6; cursor: not-allowed; }

        @media (max-width: 1100px) {
          .stats { grid-template-columns: repeat(2, 1fr); }
          .grid { grid-template-columns: 1fr; }
          .formGrid { grid-template-columns: 1fr; }
        }

        @media (max-width: 720px) {
          .page { padding: 16px; padding-bottom: 140px; }

          .hero {
            flex-direction: column;
            align-items: flex-start;
            padding: 28px;
          }

          h1 { font-size: 44px; }

          .stats { grid-template-columns: 1fr; }

          .item {
            grid-template-columns: 46px 1fr;
          }

          .item em {
            grid-column: 1 / -1;
            width: fit-content;
          }

          .itemIcon {
            width: 46px;
            height: 46px;
          }
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
