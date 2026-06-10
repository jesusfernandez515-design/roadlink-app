"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type PlatformSettings = {
  platformName?: string;
  supportEmail?: string;
  supportPhone?: string;

  roadLinkFeePercent?: number;
  bookingFee?: number;
  cancellationFee?: number;
  payoutFee?: number;

  maintenanceMode?: boolean;
  registrationOpen?: boolean;
  allowNewDrivers?: boolean;
  allowNewRides?: boolean;
  requireDriverVerification?: boolean;
  blockSuspendedUsers?: boolean;

  updatedAt?: string;
};

const DEFAULT_SETTINGS: PlatformSettings = {
  platformName: "RoadLink",
  supportEmail: "support@getroadlink.com",
  supportPhone: "",
  roadLinkFeePercent: 12,
  bookingFee: 0,
  cancellationFee: 0,
  payoutFee: 0,
  maintenanceMode: false,
  registrationOpen: true,
  allowNewDrivers: true,
  allowNewRides: true,
  requireDriverVerification: true,
  blockSuspendedUsers: true,
};

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_SETTINGS);
  const [message, setMessage] = useState("Loading settings...");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const settingsRef = doc(db, "platformSettings", "main");

    const unsubscribe = onSnapshot(
      settingsRef,
      async (snapshot) => {
        if (!snapshot.exists()) {
          await setDoc(settingsRef, {
            ...DEFAULT_SETTINGS,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          setSettings(DEFAULT_SETTINGS);
          setMessage("");
          return;
        }

        const data = snapshot.data() as PlatformSettings;

        setSettings({
          ...DEFAULT_SETTINGS,
          ...data,
        });

        setMessage("");
      },
      (error) => setMessage(error.message)
    );

    return () => unsubscribe();
  }, []);

  const platformHealth = useMemo(() => {
    if (settings.maintenanceMode) return "Maintenance";
    if (!settings.registrationOpen) return "Limited";
    if (!settings.allowNewRides) return "Rides Paused";
    return "Live";
  }, [settings]);

  const riskLevel = useMemo(() => {
    if (!settings.blockSuspendedUsers) return "High";
    if (!settings.requireDriverVerification) return "Medium";
    return "Low";
  }, [settings]);

  function updateField<K extends keyof PlatformSettings>(
    key: K,
    value: PlatformSettings[K]
  ) {
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
        doc(db, "platformSettings", "main"),
        {
          ...settings,
          platformName: settings.platformName?.trim() || "RoadLink",
          supportEmail: settings.supportEmail?.trim() || "",
          supportPhone: settings.supportPhone?.trim() || "",
          roadLinkFeePercent: Number(settings.roadLinkFeePercent || 0),
          bookingFee: Number(settings.bookingFee || 0),
          cancellationFee: Number(settings.cancellationFee || 0),
          payoutFee: Number(settings.payoutFee || 0),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      setMessage("Settings saved successfully.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function resetDefaults() {
    const confirmReset = window.confirm(
      "Are you sure you want to reset RoadLink settings to default?"
    );

    if (!confirmReset) return;

    try {
      setSaving(true);
      setMessage("");

      await setDoc(
        doc(db, "platformSettings", "main"),
        {
          ...DEFAULT_SETTINGS,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      setSettings(DEFAULT_SETTINGS);
      setMessage("Settings reset to default.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not reset settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin Home</Link>
          <Link href="/admin/analytics" className="miniButton">Analytics</Link>
          <Link href="/admin/users" className="miniButton">Users</Link>
          <Link href="/dashboard" className="miniButton">Dashboard</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Admin</p>
            <h1>Platform <span>Settings</span></h1>
            <p className="subtitle">
              Control platform rules, fees, support information, security settings,
              and maintenance mode without editing code.
            </p>
          </div>

          <div className="heroIcon">⚙️</div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="kpiGrid">
          <Kpi icon="🌎" label="Platform Status" value={platformHealth} />
          <Kpi icon="💰" label="RoadLink Fee" value={`${settings.roadLinkFeePercent || 0}%`} />
          <Kpi icon="🛡️" label="Risk Level" value={riskLevel} alert={riskLevel !== "Low"} />
          <Kpi icon="🚘" label="New Rides" value={settings.allowNewRides ? "Allowed" : "Paused"} />
        </section>

        <section className="settingsGrid">
          <Panel title="General Settings" eyebrow="Platform" icon="🌎">
            <Field
              label="Platform Name"
              value={settings.platformName || ""}
              onChange={(value) => updateField("platformName", value)}
            />

            <Field
              label="Support Email"
              value={settings.supportEmail || ""}
              onChange={(value) => updateField("supportEmail", value)}
            />

            <Field
              label="Support Phone"
              value={settings.supportPhone || ""}
              onChange={(value) => updateField("supportPhone", value)}
            />

            <Toggle
              label="Maintenance Mode"
              value={Boolean(settings.maintenanceMode)}
              onChange={(value) => updateField("maintenanceMode", value)}
              description="When enabled, RoadLink can show maintenance messaging."
            />

            <Toggle
              label="Registration Open"
              value={Boolean(settings.registrationOpen)}
              onChange={(value) => updateField("registrationOpen", value)}
              description="Allow new users to register."
            />
          </Panel>

          <Panel title="Financial Settings" eyebrow="Money" icon="💰">
            <NumberField
              label="RoadLink Fee Percent"
              value={Number(settings.roadLinkFeePercent || 0)}
              onChange={(value) => updateField("roadLinkFeePercent", value)}
            />

            <NumberField
              label="Booking Fee"
              value={Number(settings.bookingFee || 0)}
              onChange={(value) => updateField("bookingFee", value)}
            />

            <NumberField
              label="Cancellation Fee"
              value={Number(settings.cancellationFee || 0)}
              onChange={(value) => updateField("cancellationFee", value)}
            />

            <NumberField
              label="Payout Fee"
              value={Number(settings.payoutFee || 0)}
              onChange={(value) => updateField("payoutFee", value)}
            />

            <div className="noteBox">
              <strong>Current Formula</strong>
              <p>
                Driver balance = completed earnings - RoadLink fee - paid payouts.
              </p>
            </div>
          </Panel>

          <Panel title="Driver Rules" eyebrow="Verification" icon="🚘">
            <Toggle
              label="Allow New Drivers"
              value={Boolean(settings.allowNewDrivers)}
              onChange={(value) => updateField("allowNewDrivers", value)}
              description="Allow users to submit driver verification."
            />

            <Toggle
              label="Allow New Rides"
              value={Boolean(settings.allowNewRides)}
              onChange={(value) => updateField("allowNewRides", value)}
              description="Allow drivers to publish new rides."
            />

            <Toggle
              label="Require Driver Verification"
              value={Boolean(settings.requireDriverVerification)}
              onChange={(value) => updateField("requireDriverVerification", value)}
              description="Only verified drivers should be able to publish rides."
            />
          </Panel>

          <Panel title="Security Settings" eyebrow="Safety" icon="🛡️">
            <Toggle
              label="Block Suspended Users"
              value={Boolean(settings.blockSuspendedUsers)}
              onChange={(value) => updateField("blockSuspendedUsers", value)}
              description="Prevent suspended users from using protected features."
            />

            <div className={riskLevel === "Low" ? "securityBox goodBox" : "securityBox badBox"}>
              <strong>Security Risk: {riskLevel}</strong>
              <p>
                {riskLevel === "Low"
                  ? "Security settings are strict enough for the current MVP."
                  : "Review verification and suspension settings before public launch."}
              </p>
            </div>
          </Panel>
        </section>

        <section className="saveCard">
          <div>
            <p className="eyebrow">Save Changes</p>
            <h2>Apply Platform Settings</h2>
            <p>
              These settings are stored in Firestore at:
              <br />
              <strong>platformSettings / main</strong>
            </p>
          </div>

          <div className="saveActions">
            <button onClick={saveSettings} disabled={saving} className="saveButton">
              {saving ? "Saving..." : "Save Settings"}
            </button>

            <button onClick={resetDefaults} disabled={saving} className="resetButton">
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

        .container {
          max-width: 1180px;
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
        .kpi,
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

        h1 {
          font-size: 58px;
          line-height: 1;
          margin: 0 0 16px;
        }

        h1 span,
        h2,
        .kpiValue {
          color: #22c55e;
        }

        h2 {
          font-size: 30px;
          margin: 0;
        }

        .subtitle {
          max-width: 760px;
          color: #a1a1aa;
          font-size: 18px;
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

        .kpiGrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-bottom: 24px;
        }

        .kpi {
          border-radius: 24px;
          padding: 20px;
        }

        .kpi.alert {
          border-color: rgba(239,68,68,0.35);
          background: rgba(127,29,29,0.2);
        }

        .kpiIcon {
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

        .kpiLabel {
          display: block;
          color: #a1a1aa;
          font-size: 13px;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .kpiValue {
          display: block;
          font-size: 28px;
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .settingsGrid {
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

        .field {
          margin-bottom: 16px;
        }

        .field label,
        .toggleTop strong {
          display: block;
          margin-bottom: 8px;
          font-weight: 900;
        }

        input {
          width: 100%;
          padding: 15px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
          color: white;
          font-size: 16px;
          outline: none;
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

        .toggleRow p {
          color: #a1a1aa;
          margin: 0;
          line-height: 1.4;
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

        .noteBox,
        .securityBox {
          padding: 16px;
          border-radius: 18px;
          margin-top: 12px;
        }

        .noteBox {
          background: rgba(34,197,94,0.08);
          border: 1px solid rgba(34,197,94,0.25);
        }

        .goodBox {
          background: rgba(34,197,94,0.08);
          border: 1px solid rgba(34,197,94,0.25);
        }

        .badBox {
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.25);
        }

        .noteBox p,
        .securityBox p,
        .saveCard p {
          color: #a1a1aa;
          line-height: 1.5;
          margin-bottom: 0;
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
          .kpiGrid,
          .settingsGrid {
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

          h1 {
            font-size: 44px;
          }

          .kpiGrid,
          .settingsGrid {
            grid-template-columns: 1fr;
          }

          .panel {
            padding: 22px;
          }

          .saveButton,
          .resetButton {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}

function Kpi({
  icon,
  label,
  value,
  alert,
}: {
  icon: string;
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div className={alert ? "kpi alert" : "kpi"}>
      <div className="kpiIcon">{icon}</div>
      <span className="kpiLabel">{label}</span>
      <strong className="kpiValue">{value}</strong>
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
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
  description,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  description: string;
}) {
  return (
    <div className="toggleRow">
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
