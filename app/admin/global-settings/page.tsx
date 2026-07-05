"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type GlobalSettings = {
  roadLinkCommissionPercent: number;
  minimumTripPrice: number;
  pricePerMile: number;
  maxRideMiles: number;
  maxSeatsPerRide: number;
  cancellationWindowHours: number;
  driverCancellationLimit: number;
  passengerCancellationLimit: number;
  taxPercent: number;
  platformMode: "private_mvp" | "public_launch" | "maintenance";
  supportEmail: string;
  emergencyEmail: string;
  updatedAt?: string;
};

const DEFAULT_SETTINGS: GlobalSettings = {
  roadLinkCommissionPercent: 12,
  minimumTripPrice: 10,
  pricePerMile: 0.28,
  maxRideMiles: 800,
  maxSeatsPerRide: 6,
  cancellationWindowHours: 24,
  driverCancellationLimit: 3,
  passengerCancellationLimit: 5,
  taxPercent: 0,
  platformMode: "private_mvp",
  supportEmail: "support@getroadlink.com",
  emergencyEmail: "safety@getroadlink.com",
};

export default function AdminGlobalSettingsPage() {
  const [settings, setSettings] = useState<GlobalSettings>(DEFAULT_SETTINGS);
  const [message, setMessage] = useState("Loading global settings...");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const ref = doc(db, "globalSettings", "main");

    const unsubscribe = onSnapshot(
      ref,
      async (snapshot) => {
        if (!snapshot.exists()) {
          await setDoc(ref, {
            ...DEFAULT_SETTINGS,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          setSettings(DEFAULT_SETTINGS);
          setMessage("");
          return;
        }

        setSettings({
          ...DEFAULT_SETTINGS,
          ...(snapshot.data() as GlobalSettings),
        });

        setMessage("");
      },
      (error) => setMessage(error.message)
    );

    return () => unsubscribe();
  }, []);

  const score = useMemo(() => {
    let value = 100;

    if (settings.platformMode === "maintenance") value -= 35;
    if (settings.roadLinkCommissionPercent <= 0) value -= 20;
    if (settings.minimumTripPrice <= 0) value -= 15;
    if (settings.pricePerMile <= 0) value -= 15;
    if (!settings.supportEmail.includes("@")) value -= 10;
    if (!settings.emergencyEmail.includes("@")) value -= 10;

    return Math.max(0, Math.min(100, value));
  }, [settings]);

  function updateNumber(key: keyof GlobalSettings, value: string) {
    setSettings((current) => ({
      ...current,
      [key]: Number(value),
    }));
  }

  function updateText(key: keyof GlobalSettings, value: string) {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function saveSettings() {
    try {
      setSaving(true);
      setMessage("");

      await setDoc(
        doc(db, "globalSettings", "main"),
        {
          ...settings,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      setMessage("Global settings saved.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  async function resetDefaults() {
    const confirmReset = window.confirm("Reset global settings to default?");
    if (!confirmReset) return;

    try {
      setSaving(true);
      await setDoc(
        doc(db, "globalSettings", "main"),
        {
          ...DEFAULT_SETTINGS,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      setSettings(DEFAULT_SETTINGS);
      setMessage("Settings reset to default.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/settings" className="miniButton">Settings</Link>
          <Link href="/admin/feature-flags" className="miniButton">Feature Flags</Link>
          <Link href="/admin/system-health" className="miniButton">System Health</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Control Plane</p>
            <h1>Global <span>Settings</span></h1>
            <p className="subtitle">
              Control commissions, pricing, ride limits, cancellation rules, taxes,
              support emails and platform mode from Firestore.
            </p>
          </div>

          <div className={score >= 75 ? "scoreOrb" : "scoreOrb warning"}>
            <strong>{score}</strong>
            <span>Config Score</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="🏛️" label="Commission" value={`${settings.roadLinkCommissionPercent}%`} />
          <Metric icon="💵" label="Minimum Price" value={`$${settings.minimumTripPrice}`} />
          <Metric icon="🛣️" label="Per Mile" value={`$${settings.pricePerMile}`} />
          <Metric icon="🌎" label="Mode" value={settings.platformMode.replaceAll("_", " ")} />
        </section>

        <section className="grid">
          <Panel title="Pricing Rules" eyebrow="Revenue" icon="💰">
            <Field label="RoadLink Commission %" value={settings.roadLinkCommissionPercent} onChange={(v) => updateNumber("roadLinkCommissionPercent", v)} />
            <Field label="Minimum Trip Price" value={settings.minimumTripPrice} onChange={(v) => updateNumber("minimumTripPrice", v)} />
            <Field label="Price Per Mile" value={settings.pricePerMile} onChange={(v) => updateNumber("pricePerMile", v)} />
            <Field label="Tax Percent" value={settings.taxPercent} onChange={(v) => updateNumber("taxPercent", v)} />
          </Panel>

          <Panel title="Ride Limits" eyebrow="Marketplace" icon="🚘">
            <Field label="Max Ride Miles" value={settings.maxRideMiles} onChange={(v) => updateNumber("maxRideMiles", v)} />
            <Field label="Max Seats Per Ride" value={settings.maxSeatsPerRide} onChange={(v) => updateNumber("maxSeatsPerRide", v)} />
            <Field label="Cancellation Window Hours" value={settings.cancellationWindowHours} onChange={(v) => updateNumber("cancellationWindowHours", v)} />
          </Panel>

          <Panel title="Cancellation Rules" eyebrow="Trust" icon="⚖️">
            <Field label="Driver Cancellation Limit" value={settings.driverCancellationLimit} onChange={(v) => updateNumber("driverCancellationLimit", v)} />
            <Field label="Passenger Cancellation Limit" value={settings.passengerCancellationLimit} onChange={(v) => updateNumber("passengerCancellationLimit", v)} />
          </Panel>

          <Panel title="Platform Control" eyebrow="System" icon="🛡️">
            <label>Platform Mode</label>
            <select
              value={settings.platformMode}
              onChange={(event) => updateText("platformMode", event.target.value)}
            >
              <option value="private_mvp">Private MVP</option>
              <option value="public_launch">Public Launch</option>
              <option value="maintenance">Maintenance</option>
            </select>

            <label>Support Email</label>
            <input
              value={settings.supportEmail}
              onChange={(event) => updateText("supportEmail", event.target.value)}
            />

            <label>Emergency Email</label>
            <input
              value={settings.emergencyEmail}
              onChange={(event) => updateText("emergencyEmail", event.target.value)}
            />
          </Panel>
        </section>

        <section className="saveCard">
          <div>
            <p className="eyebrow">Apply Changes</p>
            <h2>Save Global Settings</h2>
            <p>Stored in Firestore at <strong>globalSettings / main</strong>.</p>
          </div>

          <div className="actions">
            <button onClick={saveSettings} disabled={saving}>
              {saving ? "Saving..." : "Save Settings"}
            </button>

            <button className="dangerButton" onClick={resetDefaults} disabled={saving}>
              Reset Defaults
            </button>
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
        .panel,
        .saveCard {
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

        h1 {
          font-size: 58px;
          line-height: 1;
          margin: 0 0 16px;
        }

        h1 span,
        h2,
        .metricValue,
        .scoreOrb strong {
          color: #22c55e;
        }

        h2 {
          font-size: 30px;
          margin: 0 0 14px;
        }

        .subtitle,
        .saveCard p {
          color: #a1a1aa;
          line-height: 1.5;
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
        }

        .scoreOrb.warning {
          background: rgba(239,68,68,0.12);
          border-color: rgba(239,68,68,0.35);
        }

        .scoreOrb.warning strong {
          color: #fca5a5;
        }

        .scoreOrb strong {
          font-size: 34px;
          font-weight: 900;
        }

        .scoreOrb span {
          color: #a1a1aa;
          font-size: 11px;
          font-weight: 900;
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
          margin-bottom: 24px;
        }

        .metric {
          border-radius: 24px;
          padding: 18px;
        }

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
          text-transform: capitalize;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 18px;
          margin-bottom: 24px;
        }

        .panel {
          border-radius: 28px;
          padding: 24px;
        }

        .panelHeader {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 18px;
        }

        .panelIcon {
          width: 54px;
          height: 54px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          border: 1px solid rgba(34,197,94,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 26px;
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

        select option {
          color: black;
        }

        .saveCard {
          border-radius: 28px;
          padding: 24px;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 18px;
          align-items: center;
        }

        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }

        button {
          padding: 16px 22px;
          border-radius: 999px;
          border: none;
          color: white;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          font-weight: 900;
          cursor: pointer;
        }

        .dangerButton {
          background: linear-gradient(135deg, #ef4444, #991b1b);
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        @media (max-width: 900px) {
          .hero,
          .saveCard {
            flex-direction: column;
            grid-template-columns: 1fr;
            align-items: flex-start;
          }

          .stats,
          .grid {
            grid-template-columns: 1fr;
          }

          h1 {
            font-size: 44px;
          }

          .actions,
          .actions button {
            width: 100%;
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

function Panel({
  title,
  eyebrow,
  icon,
  children,
}: {
  title: string;
  eyebrow: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        <div className="panelIcon">{icon}</div>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: string) => void;
}) {
  return (
    <>
      <label>{label}</label>
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </>
  );
            }
