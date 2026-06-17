"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type ControlSettings = {
  maintenanceMode?: boolean;
  registrationOpen?: boolean;
  allowNewRides?: boolean;
  allowBookings?: boolean;
  allowMessages?: boolean;
  allowPayouts?: boolean;
  allowDriverApplications?: boolean;
  requireDriverVerification?: boolean;
  blockSuspendedUsers?: boolean;
  emergencyMode?: boolean;
  platformNotice?: string;
  updatedAt?: string;
};

const DEFAULT_SETTINGS: ControlSettings = {
  maintenanceMode: false,
  registrationOpen: true,
  allowNewRides: true,
  allowBookings: true,
  allowMessages: true,
  allowPayouts: true,
  allowDriverApplications: true,
  requireDriverVerification: true,
  blockSuspendedUsers: true,
  emergencyMode: false,
  platformNotice: "",
};

export default function AdminPlatformControlPage() {
  const [settings, setSettings] = useState<ControlSettings>(DEFAULT_SETTINGS);
  const [message, setMessage] = useState("Loading platform control...");
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

        setSettings({
          ...DEFAULT_SETTINGS,
          ...(snapshot.data() as ControlSettings),
        });

        setMessage("");
      },
      (error) => setMessage(error.message)
    );

    return () => unsubscribe();
  }, []);

  const platformStatus = useMemo(() => {
    if (settings.emergencyMode) return "Emergency";
    if (settings.maintenanceMode) return "Maintenance";
    if (!settings.registrationOpen || !settings.allowNewRides || !settings.allowBookings) {
      return "Limited";
    }

    return "Live";
  }, [settings]);

  const safetyScore = useMemo(() => {
    let score = 100;

    if (!settings.blockSuspendedUsers) score -= 30;
    if (!settings.requireDriverVerification) score -= 20;
    if (settings.emergencyMode) score -= 25;
    if (settings.maintenanceMode) score -= 10;

    return Math.max(score, 0);
  }, [settings]);

  function updateField<K extends keyof ControlSettings>(
    key: K,
    value: ControlSettings[K]
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
          platformNotice: settings.platformNotice?.trim() || "",
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `platform-control-${Date.now()}`),
        {
          userId: "admin",
          userEmail: "admin@getroadlink.com",
          action: "Platform Control Updated",
          targetId: "platformSettings/main",
          targetType: "platformSettings",
          details: `Platform status: ${platformStatus}`,
          severity:
            settings.emergencyMode || settings.maintenanceMode ? "warning" : "success",
          createdAt: new Date().toISOString(),
        },
        { merge: true }
      );

      setMessage("Platform control settings saved.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  async function resetDefaults() {
    const confirmReset = window.confirm("Reset platform control to default settings?");

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
      setMessage("Platform control reset to default.");
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
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/settings" className="miniButton">Settings</Link>
          <Link href="/admin/live" className="miniButton">Live</Link>
          <Link href="/admin/launch" className="miniButton">Launch</Link>
          <Link href="/admin/emergency" className="miniButton dangerLink">SOS</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Command</p>
            <h1>Platform <span>Control</span></h1>
            <p className="subtitle">
              Control RoadLink live operations, maintenance mode, registrations,
              bookings, rides, messages, payouts and emergency lockdown settings.
            </p>
          </div>

          <div className={platformStatus === "Live" ? "scoreOrb" : "scoreOrb warningScore"}>
            <strong>{safetyScore}</strong>
            <span>{platformStatus}</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="🌎" label="Platform" value={platformStatus} danger={platformStatus !== "Live"} />
          <Metric icon="🛡️" label="Safety Score" value={String(safetyScore)} danger={safetyScore < 80} />
          <Metric icon="🚘" label="Rides" value={settings.allowNewRides ? "On" : "Off"} danger={!settings.allowNewRides} />
          <Metric icon="🎟️" label="Bookings" value={settings.allowBookings ? "On" : "Off"} danger={!settings.allowBookings} />
          <Metric icon="💬" label="Messages" value={settings.allowMessages ? "On" : "Off"} danger={!settings.allowMessages} />
          <Metric icon="🏦" label="Payouts" value={settings.allowPayouts ? "On" : "Off"} danger={!settings.allowPayouts} />
        </section>

        <section className="controlGrid">
          <Panel title="Platform Switches" eyebrow="Core Control" icon="🌎">
            <Toggle
              label="Maintenance Mode"
              value={Boolean(settings.maintenanceMode)}
              onChange={(value) => updateField("maintenanceMode", value)}
              description="Temporarily place RoadLink in maintenance mode."
            />

            <Toggle
              label="Registration Open"
              value={Boolean(settings.registrationOpen)}
              onChange={(value) => updateField("registrationOpen", value)}
              description="Allow new users to create accounts."
            />

            <Toggle
              label="Emergency Mode"
              value={Boolean(settings.emergencyMode)}
              onChange={(value) => updateField("emergencyMode", value)}
              description="Activate emergency lockdown mode for safety incidents."
              danger
            />
          </Panel>

          <Panel title="Feature Access" eyebrow="Live Features" icon="⚡">
            <Toggle
              label="Allow New Rides"
              value={Boolean(settings.allowNewRides)}
              onChange={(value) => updateField("allowNewRides", value)}
              description="Allow drivers to publish new rides."
            />

            <Toggle
              label="Allow Bookings"
              value={Boolean(settings.allowBookings)}
              onChange={(value) => updateField("allowBookings", value)}
              description="Allow passengers to reserve available rides."
            />

            <Toggle
              label="Allow Messages"
              value={Boolean(settings.allowMessages)}
              onChange={(value) => updateField("allowMessages", value)}
              description="Allow users to send and receive messages."
            />

            <Toggle
              label="Allow Payouts"
              value={Boolean(settings.allowPayouts)}
              onChange={(value) => updateField("allowPayouts", value)}
              description="Allow drivers to request payouts."
            />
          </Panel>

          <Panel title="Driver Controls" eyebrow="Verification" icon="🚘">
            <Toggle
              label="Allow Driver Applications"
              value={Boolean(settings.allowDriverApplications)}
              onChange={(value) => updateField("allowDriverApplications", value)}
              description="Allow users to apply for driver verification."
            />

            <Toggle
              label="Require Driver Verification"
              value={Boolean(settings.requireDriverVerification)}
              onChange={(value) => updateField("requireDriverVerification", value)}
              description="Require approval before users can drive."
            />
          </Panel>

          <Panel title="Security Controls" eyebrow="Trust & Safety" icon="🛡️">
            <Toggle
              label="Block Suspended Users"
              value={Boolean(settings.blockSuspendedUsers)}
              onChange={(value) => updateField("blockSuspendedUsers", value)}
              description="Prevent suspended users from using protected actions."
              danger={!settings.blockSuspendedUsers}
            />

            <div className={safetyScore >= 80 ? "securityBox goodBox" : "securityBox badBox"}>
              <strong>Safety Score: {safetyScore}</strong>
              <p>
                {safetyScore >= 80
                  ? "Platform safety controls are strong."
                  : "Review security settings before public launch."}
              </p>
            </div>
          </Panel>
        </section>

        <section className="noticeCard">
          <p className="eyebrow">Platform Notice</p>
          <h2>User-Facing Announcement</h2>

          <textarea
            value={settings.platformNotice || ""}
            onChange={(event) => updateField("platformNotice", event.target.value)}
            placeholder="Example: RoadLink will be under maintenance tonight from 10 PM to 11 PM."
          />
        </section>

        <section className="saveCard">
          <div>
            <p className="eyebrow">Apply Changes</p>
            <h2>Save Platform Control</h2>
            <p>
              These controls are stored in Firestore at:
              <br />
              <strong>platformSettings / main</strong>
            </p>
          </div>

          <div className="saveActions">
            <button className="saveButton" onClick={saveSettings} disabled={saving}>
              {saving ? "Saving..." : "Save Controls"}
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
            radial-gradient(circle at top right, rgba(239,68,68,0.18), transparent 34%),
            radial-gradient(circle at bottom left, rgba(34,197,94,0.13), transparent 35%),
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

        .dangerLink {
          color: #fca5a5;
          background: rgba(239,68,68,0.12);
          border-color: rgba(239,68,68,0.35);
        }

        .hero,
        .metric,
        .panel,
        .noticeCard,
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
        .metricValue {
          color: #22c55e;
        }

        h2 {
          font-size: 30px;
          margin: 0;
        }

        .subtitle,
        .saveCard p,
        .securityBox p {
          color: #a1a1aa;
          line-height: 1.5;
        }

        .scoreOrb {
          min-width: 96px;
          height: 96px;
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

        .warningScore {
          background: rgba(239,68,68,0.12);
          border-color: rgba(239,68,68,0.35);
        }

        .scoreOrb strong {
          color: #22c55e;
          font-size: 30px;
          font-weight: 900;
        }

        .warningScore strong {
          color: #fca5a5;
        }

        .scoreOrb span {
          color: #a1a1aa;
          font-size: 10px;
          font-weight: 900;
        }

        .message {
          color: #22c55e;
          font-weight: 900;
          margin: 16px 0;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 14px;
          margin-bottom: 24px;
        }

        .metric {
          border-radius: 24px;
          padding: 18px;
        }

        .dangerMetric {
          border-color: rgba(239,68,68,0.35);
          background: rgba(127,29,29,0.2);
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
          font-size: 22px;
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .controlGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 18px;
          margin-bottom: 24px;
        }

        .panel,
        .noticeCard,
        .saveCard {
          border-radius: 30px;
          padding: 28px;
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

        .toggleRow.alertToggle {
          border-color: rgba(239,68,68,0.35);
          background: rgba(127,29,29,0.16);
        }

        .toggleText strong {
          display: block;
          margin-bottom: 6px;
        }

        .toggleText p {
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
          background: rgba(239,68,68,0.45);
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

        .securityBox {
          padding: 16px;
          border-radius: 18px;
          margin-top: 12px;
        }

        .goodBox {
          background: rgba(34,197,94,0.08);
          border: 1px solid rgba(34,197,94,0.25);
        }

        .badBox {
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.25);
        }

        textarea {
          width: 100%;
          min-height: 130px;
          margin-top: 16px;
          padding: 16px;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
          color: white;
          font-size: 16px;
          outline: none;
          resize: vertical;
          font-family: Arial, sans-serif;
        }

        .saveCard {
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

        @media (max-width: 1100px) {
          .stats {
            grid-template-columns: repeat(3, 1fr);
          }

          .controlGrid,
          .saveCard {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 720px) {
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

          .stats {
            grid-template-columns: 1fr;
          }

          .panel,
          .noticeCard,
          .saveCard {
            padding: 24px;
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

function Metric({
  icon,
  label,
  value,
  danger,
}: {
  icon: string;
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className={danger ? "metric dangerMetric" : "metric"}>
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
  danger,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  description: string;
  danger?: boolean;
}) {
  return (
    <div className={danger ? "toggleRow alertToggle" : "toggleRow"}>
      <div className="toggleText">
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
