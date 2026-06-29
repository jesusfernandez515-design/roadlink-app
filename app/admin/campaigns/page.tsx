"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "../../../lib/firebase";

type UserProfile = {
  id: string;
  email?: string;
  role?: string;
  admin?: boolean;
  driverVerified?: boolean;
  createdAt?: any;
};

type CampaignStatus = "draft" | "active" | "paused" | "completed" | "cancelled";
type CampaignChannel = "facebook" | "instagram" | "tiktok" | "email" | "sms" | "push" | "local";
type CampaignAudience = "all" | "drivers" | "passengers" | "new_users" | "business";

type Campaign = {
  id: string;
  title?: string;
  channel?: CampaignChannel | string;
  audience?: CampaignAudience | string;
  status?: CampaignStatus | string;
  budget?: number;
  spend?: number;
  impressions?: number;
  clicks?: number;
  conversions?: number;
  goal?: string;
  startDate?: string;
  endDate?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
};

export default function AdminCampaignsPage() {
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selected, setSelected] = useState<Campaign | null>(null);
  const [message, setMessage] = useState("Loading campaigns center...");
  const [saving, setSaving] = useState(false);
  const [processingId, setProcessingId] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [title, setTitle] = useState("");
  const [channel, setChannel] = useState<CampaignChannel>("instagram");
  const [audience, setAudience] = useState<CampaignAudience>("all");
  const [budget, setBudget] = useState("100");
  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    let unsubscribeMe: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      unsubscribeMe = onSnapshot(
        doc(db, "users", user.uid),
        (snapshot) => {
          const data = snapshot.exists()
            ? ({ id: snapshot.id, ...snapshot.data() } as UserProfile)
            : ({ id: user.uid, email: user.email || "" } as UserProfile);

          setCurrentUser(data);

          const allowed =
            data.admin === true ||
            data.role === "admin" ||
            user.email === "jesusfernandez515@gmail.com";

          setMessage(allowed ? "" : "Access denied. Admin account required.");
        },
        (error) => setMessage(error.message)
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeMe) unsubscribeMe();
    };
  }, [router]);

  const adminAllowed =
    currentUser?.admin === true ||
    currentUser?.role === "admin" ||
    auth.currentUser?.email === "jesusfernandez515@gmail.com";

  useEffect(() => {
    if (!adminAllowed) return;

    const unsubUsers = onSnapshot(query(collection(db, "users")), (snapshot) => {
      setUsers(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as UserProfile[]);
      setMessage("");
    });

    const unsubCampaigns = onSnapshot(query(collection(db, "marketingCampaigns")), (snapshot) => {
      const data = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })) as Campaign[];

      data.sort((a, b) =>
        String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
      );

      setCampaigns(data);
      setSelected((current) => {
        if (!current) return data[0] || null;
        return data.find((item) => item.id === current.id) || data[0] || null;
      });
      setMessage("");
    });

    return () => {
      unsubUsers();
      unsubCampaigns();
    };
  }, [adminAllowed]);

  function clean(value?: string) {
    return String(value || "").toLowerCase();
  }

  function money(value?: number) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  function percent(value: number) {
    return `${Number(value || 0).toFixed(1)}%`;
  }

  function formatDate(value?: string) {
    if (!value) return "Not scheduled";
    try {
      return new Date(value).toLocaleDateString();
    } catch {
      return "Not scheduled";
    }
  }

  const metrics = useMemo(() => {
    const active = campaigns.filter((item) => item.status === "active");
    const paused = campaigns.filter((item) => item.status === "paused");
    const completed = campaigns.filter((item) => item.status === "completed");
    const draft = campaigns.filter((item) => !item.status || item.status === "draft");

    const totalBudget = campaigns.reduce((total, item) => total + Number(item.budget || 0), 0);
    const totalSpend = campaigns.reduce((total, item) => total + Number(item.spend || 0), 0);
    const totalImpressions = campaigns.reduce((total, item) => total + Number(item.impressions || 0), 0);
    const totalClicks = campaigns.reduce((total, item) => total + Number(item.clicks || 0), 0);
    const totalConversions = campaigns.reduce((total, item) => total + Number(item.conversions || 0), 0);

    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;
    const costPerConversion = totalConversions > 0 ? totalSpend / totalConversions : 0;

    const drivers = users.filter((user) => user.driverVerified || user.role === "driver").length;
    const passengers = users.length - drivers;

    return {
      total: campaigns.length,
      active: active.length,
      paused: paused.length,
      completed: completed.length,
      draft: draft.length,
      totalBudget,
      totalSpend,
      remainingBudget: Math.max(totalBudget - totalSpend, 0),
      totalImpressions,
      totalClicks,
      totalConversions,
      ctr,
      conversionRate,
      costPerConversion,
      users: users.length,
      drivers,
      passengers,
    };
  }, [campaigns, users]);

  const filteredCampaigns = useMemo(() => {
    const value = search.trim().toLowerCase();

    return campaigns.filter((campaign) => {
      const matchesSearch =
        !value ||
        clean(campaign.title).includes(value) ||
        clean(campaign.channel).includes(value) ||
        clean(campaign.audience).includes(value) ||
        clean(campaign.goal).includes(value) ||
        clean(campaign.id).includes(value);

      const matchesFilter =
        filter === "all" ||
        campaign.status === filter ||
        campaign.channel === filter ||
        campaign.audience === filter;

      return matchesSearch && matchesFilter;
    });
  }, [campaigns, search, filter]);

  async function createCampaign() {
    if (!title.trim()) {
      setMessage("Campaign title is required.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const now = new Date().toISOString();

      await addDoc(collection(db, "marketingCampaigns"), {
        title: title.trim(),
        channel,
        audience,
        budget: Number(budget || 0),
        spend: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        goal: goal.trim(),
        status: "draft",
        startDate,
        endDate,
        createdAt: now,
        updatedAt: now,
        createdBy: auth.currentUser?.email || "",
      });

      await addDoc(collection(db, "auditLogs"), {
        action: "Marketing Campaign Created",
        targetType: "marketingCampaign",
        details: `${title} campaign created.`,
        severity: "info",
        adminEmail: auth.currentUser?.email || "",
        createdAt: now,
        resolved: true,
      });

      setTitle("");
      setChannel("instagram");
      setAudience("all");
      setBudget("100");
      setGoal("");
      setStartDate("");
      setEndDate("");
      setMessage("Campaign created successfully.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not create campaign.");
    } finally {
      setSaving(false);
    }
  }

  async function updateCampaignStatus(campaign: Campaign, nextStatus: CampaignStatus) {
    try {
      setProcessingId(campaign.id);
      setMessage("");

      const now = new Date().toISOString();

      await updateDoc(doc(db, "marketingCampaigns", campaign.id), {
        status: nextStatus,
        updatedAt: now,
      });

      await addDoc(collection(db, "auditLogs"), {
        action: "Campaign Status Updated",
        targetId: campaign.id,
        targetType: "marketingCampaign",
        details: `${campaign.title || "Campaign"} moved to ${nextStatus}.`,
        severity: nextStatus === "active" ? "success" : "info",
        adminEmail: auth.currentUser?.email || "",
        createdAt: now,
        resolved: true,
      });

      setMessage(`Campaign marked as ${nextStatus}.`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not update campaign.");
    } finally {
      setProcessingId("");
    }
  }

  async function simulatePerformance(campaign: Campaign) {
    try {
      setProcessingId(campaign.id);
      setMessage("");

      const currentImpressions = Number(campaign.impressions || 0);
      const currentClicks = Number(campaign.clicks || 0);
      const currentConversions = Number(campaign.conversions || 0);
      const currentSpend = Number(campaign.spend || 0);
      const budgetLimit = Number(campaign.budget || 0);

      const addedImpressions = Math.floor(Math.random() * 900 + 100);
      const addedClicks = Math.floor(addedImpressions * (Math.random() * 0.08 + 0.02));
      const addedConversions = Math.floor(addedClicks * (Math.random() * 0.25 + 0.05));
      const addedSpend = Number((Math.random() * 25 + 5).toFixed(2));

      await updateDoc(doc(db, "marketingCampaigns", campaign.id), {
        impressions: currentImpressions + addedImpressions,
        clicks: currentClicks + addedClicks,
        conversions: currentConversions + addedConversions,
        spend: Math.min(currentSpend + addedSpend, budgetLimit || currentSpend + addedSpend),
        updatedAt: new Date().toISOString(),
      });

      setMessage("Campaign performance updated.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not update performance.");
    } finally {
      setProcessingId("");
    }
  }

  function statusClass(value?: string) {
    if (value === "active") return "pill active";
    if (value === "paused") return "pill paused";
    if (value === "completed") return "pill completed";
    if (value === "cancelled") return "pill cancelled";
    return "pill draft";
  }

  function channelIcon(value?: string) {
    if (value === "facebook") return "📘";
    if (value === "instagram") return "📸";
    if (value === "tiktok") return "🎵";
    if (value === "email") return "📧";
    if (value === "sms") return "💬";
    if (value === "push") return "🔔";
    return "📍";
  }

  if (!adminAllowed) {
    return (
      <main className="page">
        <section className="locked">
          <h1>Campaigns <span>Center</span></h1>
          <p>{message || "Checking admin access..."}</p>
          <Link href="/dashboard" className="navButton">Back to Dashboard</Link>
        </section>
        <Styles />
      </main>
    );
  }

  const selectedClicks = Number(selected?.clicks || 0);
  const selectedImpressions = Number(selected?.impressions || 0);
  const selectedConversions = Number(selected?.conversions || 0);
  const selectedSpend = Number(selected?.spend || 0);
  const selectedBudget = Number(selected?.budget || 0);
  const selectedCtr = selectedImpressions > 0 ? (selectedClicks / selectedImpressions) * 100 : 0;
  const selectedConversionRate = selectedClicks > 0 ? (selectedConversions / selectedClicks) * 100 : 0;
  const selectedBudgetUsed = selectedBudget > 0 ? (selectedSpend / selectedBudget) * 100 : 0;

  return (
    <main className="page">
      <section className="container">
        <div className="topBar">
          <Link href="/admin-console" className="navButton">← Admin Console</Link>
          <Link href="/admin/marketing" className="navButton">Marketing</Link>
          <Link href="/admin/coupons" className="navButton">Coupons</Link>
          <Link href="/admin/notifications" className="navButton">Notifications</Link>
          <Link href="/admin/analytics" className="navButton">Analytics</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Growth Engine</p>
            <h1>Campaigns <span>Center</span></h1>
            <p className="subtitle">
              Create, launch, pause, finish and monitor marketing campaigns across social media,
              email, SMS, push notifications and local ads.
            </p>
          </div>

          <div className="campaignOrb">
            <strong>{metrics.active}</strong>
            <span>Active Campaigns</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="📢" label="Campaigns" value={String(metrics.total)} />
          <Metric icon="🟢" label="Active" value={String(metrics.active)} />
          <Metric icon="⏸️" label="Paused" value={String(metrics.paused)} />
          <Metric icon="✅" label="Completed" value={String(metrics.completed)} />
          <Metric icon="💵" label="Budget" value={money(metrics.totalBudget)} />
          <Metric icon="💸" label="Spend" value={money(metrics.totalSpend)} />
          <Metric icon="👁️" label="Impressions" value={String(metrics.totalImpressions)} />
          <Metric icon="👆" label="Clicks" value={String(metrics.totalClicks)} />
          <Metric icon="🎯" label="Conversions" value={String(metrics.totalConversions)} />
          <Metric icon="📊" label="CTR" value={percent(metrics.ctr)} />
          <Metric icon="📈" label="Conv. Rate" value={percent(metrics.conversionRate)} />
          <Metric icon="🏷️" label="Cost / Conv." value={money(metrics.costPerConversion)} />
        </section>

        <section className="grid">
          <section className="panel">
            <p className="eyebrow">Create Campaign</p>
            <h2>New Growth Campaign</h2>

            <label>Campaign Title</label>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Launch promo, driver acquisition, airport campaign..." />

            <label>Channel</label>
            <select value={channel} onChange={(event) => setChannel(event.target.value as CampaignChannel)}>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
              <option value="tiktok">TikTok</option>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="push">Push Notifications</option>
              <option value="local">Local Ads</option>
            </select>

            <label>Audience</label>
            <select value={audience} onChange={(event) => setAudience(event.target.value as CampaignAudience)}>
              <option value="all">All Users</option>
              <option value="drivers">Drivers</option>
              <option value="passengers">Passengers</option>
              <option value="new_users">New Users</option>
              <option value="business">Business Accounts</option>
            </select>

            <label>Budget</label>
            <input value={budget} onChange={(event) => setBudget(event.target.value)} inputMode="decimal" placeholder="Campaign budget" />

            <label>Start Date</label>
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />

            <label>End Date</label>
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />

            <label>Campaign Goal</label>
            <textarea value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="What should this campaign achieve?" />

            <button onClick={createCampaign} disabled={saving}>
              {saving ? "Creating..." : "Create Campaign"}
            </button>
          </section>

          <section className="panel">
            <p className="eyebrow">Campaign Filters</p>
            <h2>Search & Segment</h2>

            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search campaigns..." />

            <div className="filterGrid">
              {[
                ["all", "🌐 All"],
                ["draft", "📝 Draft"],
                ["active", "🟢 Active"],
                ["paused", "⏸️ Paused"],
                ["completed", "✅ Completed"],
                ["cancelled", "❌ Cancelled"],
                ["drivers", "🚗 Drivers"],
                ["passengers", "🧍 Passengers"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  className={filter === key ? "filterButton activeFilter" : "filterButton"}
                  onClick={() => setFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="audienceBox">
              <Info label="Total Users" value={String(metrics.users)} />
              <Info label="Drivers" value={String(metrics.drivers)} />
              <Info label="Passengers" value={String(metrics.passengers)} />
              <Info label="Remaining Budget" value={money(metrics.remainingBudget)} />
            </div>
          </section>
        </section>

        <section className="adminGrid">
          <section className="panel">
            <p className="eyebrow">Campaign Queue</p>
            <h2>{filteredCampaigns.length} Campaigns</h2>

            {filteredCampaigns.length === 0 ? (
              <Empty text="No campaigns found." />
            ) : (
              <div className="campaignList">
                {filteredCampaigns.map((campaign) => (
                  <button
                    key={campaign.id}
                    className={selected?.id === campaign.id ? "campaignItem selected" : "campaignItem"}
                    onClick={() => setSelected(campaign)}
                  >
                    <div className="campaignIcon">{channelIcon(campaign.channel)}</div>

                    <div>
                      <strong>{campaign.title || "Campaign"}</strong>
                      <span>{campaign.channel || "channel"} · {campaign.audience || "audience"}</span>
                      <small>{formatDate(campaign.startDate)} → {formatDate(campaign.endDate)}</small>
                    </div>

                    <em className={statusClass(campaign.status)}>{campaign.status || "draft"}</em>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="panel">
            {selected ? (
              <>
                <div className="detailsTop">
                  <div>
                    <p className="eyebrow">Selected Campaign</p>
                    <h2>{selected.title || "Campaign"}</h2>
                    <p className="subtitle smallText">{selected.goal || "No goal added."}</p>
                  </div>

                  <span className={statusClass(selected.status)}>{selected.status || "draft"}</span>
                </div>

                <div className="performanceGrid">
                  <Info label="Budget" value={money(selectedBudget)} />
                  <Info label="Spend" value={money(selectedSpend)} />
                  <Info label="Budget Used" value={percent(selectedBudgetUsed)} />
                  <Info label="Impressions" value={String(selectedImpressions)} />
                  <Info label="Clicks" value={String(selectedClicks)} />
                  <Info label="CTR" value={percent(selectedCtr)} />
                  <Info label="Conversions" value={String(selectedConversions)} />
                  <Info label="Conversion Rate" value={percent(selectedConversionRate)} />
                </div>

                <div className="barBox">
                  <Bar label="Budget Used" value={selectedBudgetUsed} max={100} suffix="%" />
                  <Bar label="CTR" value={selectedCtr} max={100} suffix="%" />
                  <Bar label="Conversion Rate" value={selectedConversionRate} max={100} suffix="%" />
                </div>

                <div className="actionRow">
                  <button onClick={() => updateCampaignStatus(selected, "active")} disabled={processingId === selected.id}>
                    Start
                  </button>

                  <button className="pauseButton" onClick={() => updateCampaignStatus(selected, "paused")} disabled={processingId === selected.id}>
                    Pause
                  </button>

                  <button className="completeButton" onClick={() => updateCampaignStatus(selected, "completed")} disabled={processingId === selected.id}>
                    Complete
                  </button>

                  <button className="dangerButton" onClick={() => updateCampaignStatus(selected, "cancelled")} disabled={processingId === selected.id}>
                    Cancel
                  </button>

                  <button className="simulateButton" onClick={() => simulatePerformance(selected)} disabled={processingId === selected.id}>
                    Simulate Performance
                  </button>
                </div>
              </>
            ) : (
              <Empty text="Select a campaign to view details." />
            )}
          </section>
        </section>
      </section>

      <Styles />
    </main>
  );
}

function Metric({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="metric">
      <div className="metricIcon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="info">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Bar({ label, value, max, suffix }: { label: string; value: number; max: number; suffix?: string }) {
  const width = Math.max(4, Math.min(100, Math.round((value / max) * 100)));

  return (
    <div className="barRow">
      <div className="barTop">
        <span>{label}</span>
        <strong>{Number(value || 0).toFixed(1)}{suffix || ""}</strong>
      </div>

      <div className="bar">
        <div style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <h3>No data</h3>
      <p>{text}</p>
    </div>
  );
}

function Styles() {
  return (
    <style>{`
      * { box-sizing: border-box; }

      .page {
        min-height: 100vh;
        padding: 24px;
        padding-bottom: 130px;
        color: white;
        font-family: Arial, sans-serif;
        background:
          radial-gradient(circle at top right, rgba(34,197,94,0.24), transparent 35%),
          radial-gradient(circle at bottom left, rgba(59,130,246,0.14), transparent 35%),
          linear-gradient(135deg, #020617, #030712, #0f172a);
      }

      .container { max-width: 1240px; margin: auto; }

      .topBar {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-bottom: 20px;
      }

      .navButton {
        color: white;
        text-decoration: none;
        font-weight: 900;
        padding: 12px 18px;
        border-radius: 999px;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.1);
      }

      .hero,
      .metric,
      .panel,
      .locked {
        background: rgba(8,13,25,0.9);
        border: 1px solid rgba(255,255,255,0.1);
        box-shadow: 0 24px 80px rgba(0,0,0,0.55);
        backdrop-filter: blur(16px);
      }

      .hero {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 24px;
        padding: 35px;
        border-radius: 32px;
        margin-bottom: 20px;
      }

      .locked {
        max-width: 720px;
        margin: 80px auto;
        padding: 35px;
        border-radius: 32px;
        text-align: center;
      }

      .eyebrow {
        color: #22c55e;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 13px;
        margin: 0 0 10px;
      }

      h1 { margin: 0 0 16px; font-size: 60px; line-height: 1; }

      h1 span,
      h2,
      .metric strong,
      .campaignOrb strong {
        color: #22c55e;
      }

      .subtitle,
      .empty p {
        color: #a1a1aa;
        max-width: 780px;
        line-height: 1.5;
        font-size: 18px;
        margin: 0;
      }

      .smallText { font-size: 15px; overflow-wrap: anywhere; }

      .campaignOrb {
        min-width: 130px;
        height: 130px;
        border-radius: 50%;
        background: rgba(34,197,94,0.13);
        border: 1px solid rgba(34,197,94,0.35);
        display: flex;
        justify-content: center;
        align-items: center;
        flex-direction: column;
        text-align: center;
      }

      .campaignOrb strong { font-size: 42px; }
      .campaignOrb span { color: #d4d4d8; font-weight: 900; font-size: 12px; }

      .message { color: #22c55e; text-align: center; font-weight: 900; }

      .stats {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 14px;
        margin-bottom: 20px;
      }

      .metric { padding: 18px; border-radius: 22px; }
      .metricIcon { font-size: 24px; margin-bottom: 8px; }
      .metric span { display: block; color: #a1a1aa; font-size: 12px; font-weight: 900; margin-bottom: 6px; }
      .metric strong { font-size: 22px; overflow-wrap: anywhere; }

      .grid,
      .adminGrid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
      }

      .panel {
        border-radius: 30px;
        padding: 30px;
        margin-bottom: 20px;
      }

      label {
        display: block;
        margin: 14px 0 8px;
        font-weight: 900;
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
        font-family: Arial, sans-serif;
      }

      textarea {
        min-height: 110px;
        resize: vertical;
      }

      option { color: black; }

      button {
        width: 100%;
        margin-top: 16px;
        padding: 14px;
        border-radius: 999px;
        border: none;
        background: linear-gradient(135deg, #22c55e, #16a34a);
        color: white;
        font-weight: 900;
        cursor: pointer;
      }

      button:disabled { opacity: 0.55; cursor: not-allowed; }

      .filterGrid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
        margin-top: 16px;
      }

      .filterButton {
        text-align: left;
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.1);
      }

      .activeFilter {
        color: #22c55e;
        background: rgba(34,197,94,0.12);
        border-color: rgba(34,197,94,0.35);
      }

      .audienceBox,
      .performanceGrid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
        margin-top: 18px;
      }

      .info {
        padding: 13px;
        border-radius: 16px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.09);
      }

      .info span {
        display: block;
        color: #a1a1aa;
        font-size: 12px;
        font-weight: 900;
        margin-bottom: 6px;
      }

      .info strong {
        display: block;
        color: white;
        overflow-wrap: anywhere;
      }

      .campaignList { display: grid; gap: 12px; }

      .campaignItem {
        display: grid;
        grid-template-columns: auto 1fr auto;
        gap: 12px;
        align-items: center;
        text-align: left;
        border-radius: 20px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.1);
        margin: 0;
      }

      .campaignItem.selected {
        background: rgba(34,197,94,0.09);
        border-color: rgba(34,197,94,0.4);
      }

      .campaignIcon {
        width: 52px;
        height: 52px;
        border-radius: 50%;
        background: rgba(34,197,94,0.13);
        border: 1px solid rgba(34,197,94,0.35);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
      }

      .campaignItem strong,
      .campaignItem span,
      .campaignItem small {
        display: block;
        overflow-wrap: anywhere;
      }

      .campaignItem span,
      .campaignItem small {
        color: #a1a1aa;
        margin-top: 4px;
      }

      .pill {
        padding: 8px 11px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 900;
        text-transform: capitalize;
        white-space: nowrap;
        font-style: normal;
      }

      .active,
      .completed {
        color: #86efac;
        background: rgba(34,197,94,0.12);
        border: 1px solid rgba(34,197,94,0.35);
      }

      .paused,
      .draft {
        color: #fde68a;
        background: rgba(234,179,8,0.12);
        border: 1px solid rgba(234,179,8,0.35);
      }

      .cancelled {
        color: #fca5a5;
        background: rgba(239,68,68,0.12);
        border: 1px solid rgba(239,68,68,0.35);
      }

      .detailsTop {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: flex-start;
        margin-bottom: 20px;
      }

      .barBox {
        margin-top: 18px;
        padding: 18px;
        border-radius: 20px;
        background: rgba(34,197,94,0.08);
        border: 1px solid rgba(34,197,94,0.28);
      }

      .barRow { margin-bottom: 16px; }
      .barTop { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
      .barTop span { color: #a1a1aa; font-weight: 900; overflow-wrap: anywhere; }
      .barTop strong { color: #e5e7eb; white-space: nowrap; }
      .bar { height: 13px; background: rgba(255,255,255,0.08); border-radius: 999px; overflow: hidden; }
      .bar div { height: 100%; border-radius: 999px; background: linear-gradient(135deg, #22c55e, #16a34a); }

      .actionRow {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 10px;
        margin-top: 18px;
      }

      .pauseButton { background: linear-gradient(135deg, #f59e0b, #b45309); }
      .completeButton { background: linear-gradient(135deg, #22c55e, #16a34a); }
      .dangerButton { background: linear-gradient(135deg, #ef4444, #991b1b); }
      .simulateButton {
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.12);
      }

      .empty {
        min-height: 220px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        border-radius: 20px;
        padding: 20px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.09);
      }

      .empty h3 { margin: 0 0 8px; }

      @media (max-width: 1050px) {
        .hero,
        .grid,
        .adminGrid,
        .detailsTop {
          grid-template-columns: 1fr;
          flex-direction: column;
          align-items: flex-start;
        }

        .stats,
        .audienceBox,
        .performanceGrid,
        .actionRow {
          grid-template-columns: 1fr;
        }

        h1 { font-size: 44px; }
      }

      @media (max-width: 650px) {
        .page { padding: 16px; padding-bottom: 120px; }

        .hero,
        .panel {
          padding: 22px;
          border-radius: 26px;
        }

        .campaignItem {
          grid-template-columns: 1fr;
        }

        .filterGrid {
          grid-template-columns: 1fr;
        }
      }
    `}</style>
  );
        }
