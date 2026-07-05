"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "../../../lib/firebase";

type ApiStatus = "healthy" | "warning" | "offline";
type ApiKeyItem = {
  id: string;
  name?: string;
  provider?: string;
  category?: string;
  status?: ApiStatus;
  maskedKey?: string;
  environment?: string;
  requestsToday?: number;
  errorsToday?: number;
  avgLatency?: number;
  successRate?: number;
  lastRotatedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  active?: boolean;
};

const DEFAULT_APIS: Omit<ApiKeyItem, "id">[] = [
  { name: "Google Maps", provider: "google", category: "maps", status: "healthy", maskedKey: "AIza************", environment: "production", requestsToday: 1240, errorsToday: 2, avgLatency: 88, successRate: 99.7, active: true },
  { name: "Stripe", provider: "stripe", category: "payments", status: "warning", maskedKey: "sk_live_********", environment: "test", requestsToday: 84, errorsToday: 4, avgLatency: 132, successRate: 95.2, active: false },
  { name: "Firebase", provider: "firebase", category: "core", status: "healthy", maskedKey: "firebase_********", environment: "production", requestsToday: 3200, errorsToday: 1, avgLatency: 54, successRate: 99.9, active: true },
  { name: "OpenAI", provider: "openai", category: "ai", status: "healthy", maskedKey: "sk-********", environment: "production", requestsToday: 46, errorsToday: 0, avgLatency: 410, successRate: 100, active: true },
  { name: "Twilio", provider: "twilio", category: "sms", status: "offline", maskedKey: "AC********", environment: "pending", requestsToday: 0, errorsToday: 0, avgLatency: 0, successRate: 0, active: false },
  { name: "SendGrid", provider: "sendgrid", category: "email", status: "warning", maskedKey: "SG.********", environment: "pending", requestsToday: 0, errorsToday: 0, avgLatency: 0, successRate: 0, active: false },
];

export default function AdminApiKeysPage() {
  const [items, setItems] = useState<ApiKeyItem[]>([]);
  const [selected, setSelected] = useState<ApiKeyItem | null>(null);
  const [message, setMessage] = useState("Loading API keys center...");
  const [savingId, setSavingId] = useState("");
  const [showSecrets, setShowSecrets] = useState(false);
  const [filter, setFilter] = useState("all");

  const [name, setName] = useState("");
  const [provider, setProvider] = useState("");
  const [category, setCategory] = useState("core");
  const [maskedKey, setMaskedKey] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "apiKeys")),
      async (snapshot) => {
        if (snapshot.empty) {
          const now = new Date().toISOString();
          await Promise.all(
            DEFAULT_APIS.map((api) =>
              setDoc(doc(db, "apiKeys", String(api.provider)), {
                ...api,
                createdAt: now,
                updatedAt: now,
              })
            )
          );
          return;
        }

        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as ApiKeyItem[];

        data.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

        setItems(data);
        setSelected((current) => {
          if (!current) return data[0] || null;
          return data.find((item) => item.id === current.id) || data[0] || null;
        });
        setMessage("");
      },
      (error) => setMessage(error.message)
    );

    return () => unsub();
  }, []);

  const metrics = useMemo(() => {
    const healthy = items.filter((item) => item.status === "healthy");
    const warning = items.filter((item) => item.status === "warning");
    const offline = items.filter((item) => item.status === "offline");
    const active = items.filter((item) => item.active !== false);
    const requests = items.reduce((total, item) => total + Number(item.requestsToday || 0), 0);
    const errors = items.reduce((total, item) => total + Number(item.errorsToday || 0), 0);
    const avgLatency = items.length
      ? Math.round(items.reduce((total, item) => total + Number(item.avgLatency || 0), 0) / items.length)
      : 0;

    const securityScore = Math.max(
      0,
      Math.min(100, 100 - offline.length * 12 - warning.length * 5 - errors * 0.25)
    );

    return {
      total: items.length,
      healthy: healthy.length,
      warning: warning.length,
      offline: offline.length,
      active: active.length,
      requests,
      errors,
      avgLatency,
      securityScore: Math.round(securityScore),
    };
  }, [items]);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter(
      (item) =>
        item.status === filter ||
        item.category === filter ||
        item.provider === filter ||
        item.environment === filter
    );
  }, [items, filter]);

  async function createApiKey() {
    if (!name.trim() || !provider.trim()) {
      setMessage("Name and provider are required.");
      return;
    }

    try {
      setSavingId("new");
      const now = new Date().toISOString();

      await setDoc(
        doc(db, "apiKeys", provider.trim().toLowerCase().replaceAll(" ", "-")),
        {
          name: name.trim(),
          provider: provider.trim(),
          category,
          maskedKey: maskedKey.trim() || "********",
          status: "warning",
          environment: "pending",
          active: false,
          requestsToday: 0,
          errorsToday: 0,
          avgLatency: 0,
          successRate: 0,
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

      await addDoc(collection(db, "auditLogs"), {
        action: "API Key Created",
        targetType: "apiKey",
        details: `${name} integration created.`,
        severity: "info",
        adminEmail: auth.currentUser?.email || "",
        createdAt: now,
        resolved: true,
      });

      setName("");
      setProvider("");
      setCategory("core");
      setMaskedKey("");
      setMessage("API key created.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not create API key.");
    } finally {
      setSavingId("");
    }
  }

  async function updateApi(item: ApiKeyItem, updates: Partial<ApiKeyItem>) {
    try {
      setSavingId(item.id);
      const now = new Date().toISOString();

      await updateDoc(doc(db, "apiKeys", item.id), {
        ...updates,
        updatedAt: now,
      });

      await addDoc(collection(db, "auditLogs"), {
        action: "API Integration Updated",
        targetType: "apiKey",
        targetId: item.id,
        details: `${item.name || item.provider} updated.`,
        severity: updates.status === "offline" ? "warning" : "success",
        adminEmail: auth.currentUser?.email || "",
        createdAt: now,
        resolved: true,
      });

      setMessage("API integration updated.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not update integration.");
    } finally {
      setSavingId("");
    }
  }

  async function rotateKey(item: ApiKeyItem) {
    const now = new Date().toISOString();
    await updateApi(item, {
      maskedKey: `${String(item.provider || "key").slice(0, 4)}_rotated_********`,
      lastRotatedAt: now,
      status: "healthy",
    });
  }

  function statusClass(status?: string) {
    if (status === "healthy") return "pill healthy";
    if (status === "warning") return "pill warning";
    return "pill offline";
  }

  function secretText(item?: ApiKeyItem | null) {
    if (!item) return "";
    return showSecrets ? item.maskedKey || "********" : "••••••••••••••••";
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/security-center" className="miniButton">Security</Link>
          <Link href="/admin/system-health" className="miniButton">System Health</Link>
          <Link href="/admin/audit-logs" className="miniButton">Audit Logs</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Integrations</p>
            <h1>API Keys <span>Center</span></h1>
            <p className="subtitle">
              Manage integrations, API keys, webhooks, status, latency, errors and external services.
            </p>
          </div>

          <div className={metrics.securityScore >= 80 ? "scoreOrb" : "scoreOrb warningScore"}>
            <strong>{metrics.securityScore}</strong>
            <span>Security Score</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="🔑" label="Total APIs" value={String(metrics.total)} />
          <Metric icon="✅" label="Healthy" value={String(metrics.healthy)} />
          <Metric icon="⚠️" label="Warnings" value={String(metrics.warning)} />
          <Metric icon="❌" label="Offline" value={String(metrics.offline)} />
          <Metric icon="📡" label="Requests Today" value={metrics.requests.toLocaleString()} />
          <Metric icon="🔥" label="Errors" value={String(metrics.errors)} />
          <Metric icon="⚡" label="Avg Latency" value={`${metrics.avgLatency} ms`} />
          <Metric icon="🟢" label="Active" value={String(metrics.active)} />
        </section>

        <section className="grid">
          <section className="panel">
            <p className="eyebrow">Create Integration</p>
            <h2>New API Key</h2>

            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Example: Sentry" />

            <label>Provider</label>
            <input value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="sentry" />

            <label>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="core">Core</option>
              <option value="payments">Payments</option>
              <option value="maps">Maps</option>
              <option value="ai">AI</option>
              <option value="sms">SMS</option>
              <option value="email">Email</option>
              <option value="security">Security</option>
              <option value="storage">Storage</option>
            </select>

            <label>Masked Key</label>
            <input value={maskedKey} onChange={(e) => setMaskedKey(e.target.value)} placeholder="sk_live_********" />

            <button onClick={createApiKey} disabled={savingId === "new"}>
              {savingId === "new" ? "Creating..." : "Create API Key"}
            </button>
          </section>

          <section className="panel">
            <p className="eyebrow">Filters</p>
            <h2>Integration Groups</h2>

            <div className="filterGrid">
              {[
                ["all", "🌐 All"],
                ["healthy", "✅ Healthy"],
                ["warning", "⚠️ Warning"],
                ["offline", "❌ Offline"],
                ["payments", "💳 Payments"],
                ["maps", "🗺️ Maps"],
                ["ai", "🧠 AI"],
                ["sms", "📱 SMS"],
                ["email", "📧 Email"],
                ["core", "🔥 Core"],
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

            <button className="secondaryButton" onClick={() => setShowSecrets(!showSecrets)}>
              {showSecrets ? "Hide Keys" : "Show Keys"}
            </button>
          </section>
        </section>

        <section className="adminGrid">
          <section className="panel">
            <p className="eyebrow">API Keys</p>
            <h2>{filtered.length} Integrations</h2>

            <div className="apiList">
              {filtered.map((item) => (
                <button
                  key={item.id}
                  className={selected?.id === item.id ? "apiItem selected" : "apiItem"}
                  onClick={() => setSelected(item)}
                >
                  <div>
                    <strong>{item.name || item.provider}</strong>
                    <span>{item.provider} · {item.category}</span>
                    <small>{secretText(item)}</small>
                  </div>

                  <em className={statusClass(item.status)}>{item.status || "warning"}</em>
                </button>
              ))}
            </div>
          </section>

          <section className="panel">
            {selected ? (
              <>
                <div className="detailsTop">
                  <div>
                    <p className="eyebrow">Selected Integration</p>
                    <h2>{selected.name || selected.provider}</h2>
                    <p className="subtitle smallText">{selected.provider} · {selected.category}</p>
                  </div>

                  <span className={statusClass(selected.status)}>{selected.status || "warning"}</span>
                </div>

                <div className="secretBox">
                  <span>API Key</span>
                  <strong>{secretText(selected)}</strong>
                </div>

                <div className="infoGrid">
                  <Info label="Provider" value={selected.provider || "Not available"} />
                  <Info label="Category" value={selected.category || "core"} />
                  <Info label="Environment" value={selected.environment || "pending"} />
                  <Info label="Requests Today" value={String(selected.requestsToday || 0)} />
                  <Info label="Errors Today" value={String(selected.errorsToday || 0)} />
                  <Info label="Avg Latency" value={`${selected.avgLatency || 0} ms`} />
                  <Info label="Success Rate" value={`${selected.successRate || 0}%`} />
                  <Info label="Last Rotated" value={selected.lastRotatedAt || "Never"} />
                </div>

                <div className="actionRow">
                  <button onClick={() => updateApi(selected, { active: true, status: "healthy" })} disabled={savingId === selected.id}>
                    Activate
                  </button>

                  <button className="warningButton" onClick={() => rotateKey(selected)} disabled={savingId === selected.id}>
                    Rotate
                  </button>

                  <button className="dangerButton" onClick={() => updateApi(selected, { active: false, status: "offline" })} disabled={savingId === selected.id}>
                    Disable
                  </button>
                </div>
              </>
            ) : (
              <div className="empty">
                <h3>No integration selected</h3>
                <p>Select an API key to manage it.</p>
              </div>
            )}
          </section>
        </section>

        <section className="panel">
          <p className="eyebrow">API Logs</p>
          <h2>Recent Requests</h2>

          <div className="logGrid">
            {[
              ["GET", "/rides", "200", "82 ms"],
              ["POST", "/bookings", "201", "124 ms"],
              ["POST", "/wallet", "401", "96 ms"],
              ["PATCH", "/booking", "200", "72 ms"],
              ["POST", "/login", "200", "51 ms"],
              ["POST", "/webhooks/stripe", "500", "310 ms"],
            ].map(([method, path, code, latency]) => (
              <div key={`${method}-${path}-${code}`} className="logItem">
                <strong>{method}</strong>
                <span>{path}</span>
                <em className={code.startsWith("2") ? "codeGood" : "codeBad"}>{code}</em>
                <small>{latency}</small>
              </div>
            ))}
          </div>
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
            radial-gradient(circle at top right, rgba(34,197,94,0.22), transparent 34%),
            radial-gradient(circle at bottom left, rgba(59,130,246,0.12), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
        }

        .container { max-width: 1240px; margin: auto; }

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
        .panel {
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
        h1 span, h2, .metricValue, .scoreOrb strong { color: #22c55e; }
        h2 { font-size: 30px; margin: 0 0 14px; }

        .subtitle, .empty p {
          color: #a1a1aa;
          line-height: 1.5;
        }

        .smallText { font-size: 15px; overflow-wrap: anywhere; }

        .scoreOrb {
          min-width: 112px;
          height: 112px;
          border-radius: 50%;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          text-align: center;
        }

        .warningScore {
          background: rgba(239,68,68,0.12);
          border-color: rgba(239,68,68,0.35);
        }

        .warningScore strong { color: #fca5a5; }

        .scoreOrb strong { font-size: 34px; font-weight: 900; }
        .scoreOrb span { color: #a1a1aa; font-size: 11px; font-weight: 900; }

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

        .metricValue {
          font-size: 24px;
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .grid,
        .adminGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
          margin-bottom: 24px;
        }

        .panel {
          border-radius: 28px;
          padding: 24px;
        }

        label {
          display: block;
          font-weight: 900;
          margin: 14px 0 8px;
        }

        input,
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

        option { color: black; }

        button {
          width: 100%;
          margin-top: 14px;
          padding: 14px 18px;
          border-radius: 999px;
          border: none;
          color: white;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          font-weight: 900;
          cursor: pointer;
        }

        .secondaryButton {
          background: rgba(59,130,246,0.18);
          border: 1px solid rgba(59,130,246,0.35);
        }

        .warningButton {
          background: linear-gradient(135deg, #f59e0b, #b45309);
        }

        .dangerButton {
          background: linear-gradient(135deg, #ef4444, #991b1b);
        }

        button:disabled { opacity: 0.6; cursor: not-allowed; }

        .filterGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }

        .filterButton {
          text-align: left;
          margin-top: 0;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .activeFilter {
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border-color: rgba(34,197,94,0.35);
        }

        .apiList { display: grid; gap: 12px; }

        .apiItem {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 12px;
          align-items: center;
          text-align: left;
          padding: 16px;
          margin-top: 0;
          border-radius: 20px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .apiItem.selected {
          background: rgba(34,197,94,0.09);
          border-color: rgba(34,197,94,0.4);
        }

        .apiItem strong,
        .apiItem span,
        .apiItem small {
          display: block;
          overflow-wrap: anywhere;
        }

        .apiItem span,
        .apiItem small {
          color: #a1a1aa;
          margin-top: 5px;
        }

        .pill {
          padding: 8px 11px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 900;
          text-transform: capitalize;
          font-style: normal;
        }

        .healthy {
          color: #86efac;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .warning {
          color: #fde68a;
          background: rgba(234,179,8,0.12);
          border: 1px solid rgba(234,179,8,0.35);
        }

        .offline {
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

        .secretBox {
          padding: 18px;
          border-radius: 20px;
          background: rgba(34,197,94,0.08);
          border: 1px solid rgba(34,197,94,0.28);
          margin-bottom: 18px;
        }

        .secretBox span {
          display: block;
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .secretBox strong {
          display: block;
          color: #22c55e;
          font-size: 22px;
          overflow-wrap: anywhere;
        }

        .infoGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          margin-bottom: 16px;
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

        .actionRow {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }

        .empty {
          padding: 24px;
          border-radius: 22px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .logGrid {
          display: grid;
          gap: 10px;
        }

        .logItem {
          display: grid;
          grid-template-columns: 80px 1fr 80px 100px;
          gap: 10px;
          align-items: center;
          padding: 14px;
          border-radius: 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
        }

        .logItem span,
        .logItem small {
          color: #a1a1aa;
        }

        .codeGood { color: #86efac; font-style: normal; font-weight: 900; }
        .codeBad { color: #fca5a5; font-style: normal; font-weight: 900; }

        @media (max-width: 1000px) {
          .stats,
          .grid,
          .adminGrid,
          .infoGrid,
          .actionRow {
            grid-template-columns: 1fr;
          }

          .hero,
          .detailsTop {
            flex-direction: column;
            align-items: flex-start;
          }

          h1 { font-size: 44px; }

          .logItem {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}

function Metric({ icon, label, value }: { icon: string; label: string; value: string }) {
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
    <div className="info">
      <span>{label}</span>
      <strong>{value || "Not available"}</strong>
    </div>
  );
        }
