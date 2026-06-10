"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type FeatureFlags = {
  enableBookings?: boolean;
  enableMessaging?: boolean;
  enableWallet?: boolean;
  enableDriverVerification?: boolean;
  enableCoupons?: boolean;
  enableReviews?: boolean;
  enableNotifications?: boolean;
  enableStripe?: boolean;
  enableDisputes?: boolean;
  enablePublicLaunch?: boolean;
  maintenanceMode?: boolean;
  updatedAt?: string;
};

const DEFAULT_FLAGS: FeatureFlags = {
  enableBookings: true,
  enableMessaging: true,
  enableWallet: true,
  enableDriverVerification: true,
  enableCoupons: true,
  enableReviews: true,
  enableNotifications: true,
  enableStripe: false,
  enableDisputes: true,
  enablePublicLaunch: false,
  maintenanceMode: false,
};

export default function AdminFeatureFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FLAGS);
  const [message, setMessage] = useState("Loading feature flags...");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const flagsRef = doc(db, "featureFlags", "main");

    const unsubscribe = onSnapshot(
      flagsRef,
      async (snapshot) => {
        if (!snapshot.exists()) {
          await setDoc(flagsRef, {
            ...DEFAULT_FLAGS,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          setFlags(DEFAULT_FLAGS);
          setMessage("");
          return;
        }

        setFlags({
          ...DEFAULT_FLAGS,
          ...(snapshot.data() as FeatureFlags),
        });

        setMessage("");
      },
      (error) => setMessage(error.message)
    );

    return () => unsubscribe();
  }, []);

  const enabledCount = useMemo(() => {
    return Object.entries(flags).filter(
      ([key, value]) => key !== "updatedAt" && value === true
    ).length;
  }, [flags]);

  const disabledCount = useMemo(() => {
    return Object.entries(flags).filter(
      ([key, value]) => key !== "updatedAt" && value === false
    ).length;
  }, [flags]);

  const platformMode = flags.maintenanceMode
    ? "Maintenance"
    : flags.enablePublicLaunch
    ? "Public Launch"
    : "Private MVP";

  function updateFlag(key: keyof FeatureFlags, value: boolean) {
    setFlags((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function saveFlags() {
    try {
      setSaving(true);
      setMessage("");

      await setDoc(
        doc(db, "featureFlags", "main"),
        {
          ...flags,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      setMessage("Feature flags saved successfully.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not save feature flags.");
    } finally {
      setSaving(false);
    }
  }

  async function resetDefaults() {
    const confirmReset = window.confirm(
      "Are you sure you want to reset all feature flags to default?"
    );

    if (!confirmReset) return;

    try {
      setSaving(true);
      setMessage("");

      await setDoc(
        doc(db, "featureFlags", "main"),
        {
          ...DEFAULT_FLAGS,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      setFlags(DEFAULT_FLAGS);
      setMessage("Feature flags reset to default.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not reset feature flags.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin Home</Link>
          <Link href="/admin/settings" className="miniButton">Settings</Link>
          <Link href="/admin/system-health" className="miniButton">System Health</Link>
          <Link href="/admin/analytics" className="miniButton">Analytics</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Admin</p>
            <h1>Feature <span>Flags</span></h1>
            <p className="subtitle">
              Enable or disable RoadLink features without editing code. Control MVP,
              public launch, payments, messaging, reviews, wallet, and maintenance mode.
            </p>
          </div>

          <div className="heroIcon">🚦</div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="✅" label="Enabled" value={String(enabledCount)} />
          <Metric icon="⛔" label="Disabled" value={String(disabledCount)} />
          <Metric icon="🌎" label="Mode" value={platformMode} />
          <Metric icon="🕒" label="Updated" value={flags.updatedAt ? new Date(flags.updatedAt).toLocaleDateString() : "New"} />
        </section>

        <section className="flagsGrid">
          <Panel title="Core Features" eyebrow="Platform" icon="🌎">
            <Toggle label="Enable Bookings" value={Boolean(flags.enableBookings)} onChange={(value) => updateFlag("enableBookings", value)} description="Allow passengers to reserve rides." />
            <Toggle label="Enable Messaging" value={Boolean(flags.enableMessaging)} onChange={(value) => updateFlag("enableMessaging", value)} description="Allow users to send ride messages." />
            <Toggle label="Enable Notifications" value={Boolean(flags.enableNotifications)} onChange={(value) => updateFlag("enableNotifications", value)} description="Allow notification delivery inside RoadLink." />
            <Toggle label="Enable Public Launch" value={Boolean(flags.enablePublicLaunch)} onChange={(value) => updateFlag("enablePublicLaunch", value)} description="Mark the platform as publicly launched." />
          </Panel>

          <Panel title="Driver Features" eyebrow="Drivers" icon="🚘">
            <Toggle label="Enable Driver Verification" value={Boolean(flags.enableDriverVerification)} onChange={(value) => updateFlag("enableDriverVerification", value)} description="Allow drivers to submit documents for approval." />
            <Toggle label="Enable Wallet" value={Boolean(flags.enableWallet)} onChange={(value) => updateFlag("enableWallet", value)} description="Allow drivers to view balances and request payouts." />
            <Toggle label="Enable Disputes" value={Boolean(flags.enableDisputes)} onChange={(value) => updateFlag("enableDisputes", value)} description="Allow trip disputes between passengers and drivers." />
          </Panel>

          <Panel title="Growth Features" eyebrow="Marketing" icon="📈">
            <Toggle label="Enable Coupons" value={Boolean(flags.enableCoupons)} onChange={(value) => updateFlag("enableCoupons", value)} description="Allow coupons and promo codes." />
            <Toggle label="Enable Reviews" value={Boolean(flags.enableReviews)} onChange={(value) => updateFlag("enableReviews", value)} description="Allow reviews and ratings between users." />
          </Panel>

          <Panel title="Payments & Safety" eyebrow="Control" icon="🛡️">
            <Toggle label="Enable Stripe" value={Boolean(flags.enableStripe)} onChange={(value) => updateFlag("enableStripe", value)} description="Enable real Stripe payment workflows after integration." />
            <Toggle label="Maintenance Mode" value={Boolean(flags.maintenanceMode)} onChange={(value) => updateFlag("maintenanceMode", value)} description="Temporarily pause the platform for updates." warning />
          </Panel>
        </section>

        <section className="saveCard">
          <div>
            <p className="eyebrow">Save Changes</p>
            <h2>Apply Feature Flags</h2>
            <p>
              Stored in Firestore at <strong>featureFlags / main</strong>.
            </p>
          </div>

          <div className="saveActions">
            <button className="saveButton" onClick={saveFlags} disabled={saving}>
              {saving ? "Saving..." : "Save Flags"}
            </button>

            <button className="resetButton" onClick={resetDefaults} disabled={saving}>
              Reset Defaults
            </button>
          </div>
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
        .panel,
        .saveCard {
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

        h2 { font-size: 30px; margin: 0; }

        .subtitle,
        .saveCard p,
        .toggleRow p {
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
          overflow-wrap: anywhere;
        }

        .flagsGrid {
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

        .toggleRow {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 14px;
          align-items: center;
          padding: 15px;
          border-radius: 18px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          margin-bottom: 12px;
        }

        .toggleRow.warningRow {
          background: rgba(239,68,68,0.08);
          border-color: rgba(239,68,68,0.25);
        }

        .toggleTop strong {
          display: block;
          margin-bottom: 6px;
          font-weight: 900;
        }

        .toggleRow p {
          margin: 0;
          font-size: 13px;
        }

        .toggleButton {
          width: 62px;
          height: 34px;
          border-radius: 999px;
          border: none;
          padding: 4px;
          cursor: pointer;
          background: rgba(239,68,68,0.35);
        }

        .toggleButton.on {
          background: rgba(34,197,94,0.75);
        }

        .toggleCircle {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: white;
          transition: transform 0.2s ease;
        }

        .toggleButton.on .toggleCircle {
          transform: translateX(28px);
        }

        .saveCard {
          border-radius: 28px;
          padding: 24px;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 18px;
          align-items: center;
        }

        .saveActions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }

        .saveButton,
        .resetButton {
          padding: 16px 22px;
          border-radius: 999px;
          border: none;
          color: white;
          font-weight: 900;
          cursor: pointer;
        }

        .saveButton {
          background: linear-gradient(135deg, #22c55e, #16a34a);
        }

        .resetButton {
          background: linear-gradient(135deg, #ef4444, #991b1b);
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        @media (max-width: 1000px) {
          .stats,
          .flagsGrid {
            grid-template-columns: repeat(2, 1fr);
          }

          .saveCard {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 620px) {
          .page {
            padding: 16px;
            padding-bottom: 140px;
          }

          .hero {
            flex-direction: column;
            align-items: flex-start;
            padding: 28px;
          }

          h1 { font-size: 44px; }

          .stats,
          .flagsGrid {
            grid-template-columns: 1fr;
          }

          .panel { padding: 22px; }

          .saveButton,
          .resetButton {
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

function Toggle({
  label,
  value,
  onChange,
  description,
  warning,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  description: string;
  warning?: boolean;
}) {
  return (
    <div className={warning ? "toggleRow warningRow" : "toggleRow"}>
      <div className="toggleTop">
        <strong>{label}</strong>
        <p>{description}</p>
      </div>

      <button
        type="button"
        className={value ? "toggleButton on" : "toggleButton"}
        onClick={() => onChange(!value)}
      >
        <div className="toggleCircle" />
      </button>
    </div>
  );
}
