"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { addDoc, collection, doc, onSnapshot, setDoc } from "firebase/firestore";
import { auth, db } from "../../../lib/firebase";

type UserProfile = {
  id: string;
  email?: string;
  role?: string;
  admin?: boolean;
};

type PlatformSettings = {
  platformFeePercent?: number;
  driverPayoutPercent?: number;
  minimumTripPrice?: number;
  pricePerMile?: number;
  pricePerMinute?: number;
  maxSeatsPerRide?: number;
  cancellationFee?: number;
  bookingEnabled?: boolean;
  driverVerificationRequired?: boolean;
  sosEnabled?: boolean;
  chatEnabled?: boolean;
  walletEnabled?: boolean;
  rewardsEnabled?: boolean;
  businessEnabled?: boolean;
  fleetEnabled?: boolean;
  stripeLiveMode?: boolean;
  mapsEnabled?: boolean;
  maintenanceMode?: boolean;
  supportEmail?: string;
  updatedAt?: string;
  updatedBy?: string;
};

const SETTINGS_ID = "global";

export default function AdminPlatformSettingsPage() {
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<PlatformSettings>({});
  const [message, setMessage] = useState("Loading platform settings...");
  const [saving, setSaving] = useState(false);

  const [platformFeePercent, setPlatformFeePercent] = useState("12");
  const [driverPayoutPercent, setDriverPayoutPercent] = useState("88");
  const [minimumTripPrice, setMinimumTripPrice] = useState("10");
  const [pricePerMile, setPricePerMile] = useState("0.28");
  const [pricePerMinute, setPricePerMinute] = useState("0.05");
  const [maxSeatsPerRide, setMaxSeatsPerRide] = useState("6");
  const [cancellationFee, setCancellationFee] = useState("5");
  const [supportEmail, setSupportEmail] = useState("support@roadlink.com");

  const [bookingEnabled, setBookingEnabled] = useState(true);
  const [driverVerificationRequired, setDriverVerificationRequired] = useState(true);
  const [sosEnabled, setSosEnabled] = useState(true);
  const [chatEnabled, setChatEnabled] = useState(true);
  const [walletEnabled, setWalletEnabled] = useState(true);
  const [rewardsEnabled, setRewardsEnabled] = useState(true);
  const [businessEnabled, setBusinessEnabled] = useState(true);
  const [fleetEnabled, setFleetEnabled] = useState(true);
  const [stripeLiveMode, setStripeLiveMode] = useState(false);
  const [mapsEnabled, setMapsEnabled] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);

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

    const unsubscribe = onSnapshot(
      doc(db, "platformSettings", SETTINGS_ID),
      (snapshot) => {
        if (!snapshot.exists()) {
          setMessage("");
          return;
        }

        const data = snapshot.data() as PlatformSettings;
        setSettings(data);

        setPlatformFeePercent(String(data.platformFeePercent ?? 12));
        setDriverPayoutPercent(String(data.driverPayoutPercent ?? 88));
        setMinimumTripPrice(String(data.minimumTripPrice ?? 10));
        setPricePerMile(String(data.pricePerMile ?? 0.28));
        setPricePerMinute(String(data.pricePerMinute ?? 0.05));
        setMaxSeatsPerRide(String(data.maxSeatsPerRide ?? 6));
        setCancellationFee(String(data.cancellationFee ?? 5));
        setSupportEmail(data.supportEmail || "support@roadlink.com");

        setBookingEnabled(data.bookingEnabled ?? true);
        setDriverVerificationRequired(data.driverVerificationRequired ?? true);
        setSosEnabled(data.sosEnabled ?? true);
        setChatEnabled(data.chatEnabled ?? true);
        setWalletEnabled(data.walletEnabled ?? true);
        setRewardsEnabled(data.rewardsEnabled ?? true);
        setBusinessEnabled(data.businessEnabled ?? true);
        setFleetEnabled(data.fleetEnabled ?? true);
        setStripeLiveMode(data.stripeLiveMode ?? false);
        setMapsEnabled(data.mapsEnabled ?? true);
        setMaintenanceMode(data.maintenanceMode ?? false);

        setMessage("");
      },
      (error) => setMessage(error.message)
    );

    return () => unsubscribe();
  }, [adminAllowed]);

  const metrics = useMemo(() => {
    const activeModules = [
      bookingEnabled,
      driverVerificationRequired,
      sosEnabled,
      chatEnabled,
      walletEnabled,
      rewardsEnabled,
      businessEnabled,
      fleetEnabled,
      mapsEnabled,
    ].filter(Boolean).length;

    const fee = Number(platformFeePercent || 0);
    const payout = Number(driverPayoutPercent || 0);

    const healthScore = Math.max(
      0,
      Math.min(
        100,
        100 -
          (maintenanceMode ? 35 : 0) -
          (!bookingEnabled ? 15 : 0) -
          (!mapsEnabled ? 15 : 0) -
          (!sosEnabled ? 10 : 0) -
          (fee + payout !== 100 ? 10 : 0)
      )
    );

    return {
      activeModules,
      totalModules: 9,
      fee,
      payout,
      healthScore,
      pricingValid: fee + payout === 100,
    };
  }, [
    bookingEnabled,
    driverVerificationRequired,
    sosEnabled,
    chatEnabled,
    walletEnabled,
    rewardsEnabled,
    businessEnabled,
    fleetEnabled,
    mapsEnabled,
    maintenanceMode,
    platformFeePercent,
    driverPayoutPercent,
  ]);

  async function saveSettings() {
    try {
      setSaving(true);
      setMessage("");

      const now = new Date().toISOString();

      const payload: PlatformSettings = {
        platformFeePercent: Number(platformFeePercent || 0),
        driverPayoutPercent: Number(driverPayoutPercent || 0),
        minimumTripPrice: Number(minimumTripPrice || 0),
        pricePerMile: Number(pricePerMile || 0),
        pricePerMinute: Number(pricePerMinute || 0),
        maxSeatsPerRide: Number(maxSeatsPerRide || 0),
        cancellationFee: Number(cancellationFee || 0),
        supportEmail: supportEmail.trim(),
        bookingEnabled,
        driverVerificationRequired,
        sosEnabled,
        chatEnabled,
        walletEnabled,
        rewardsEnabled,
        businessEnabled,
        fleetEnabled,
        stripeLiveMode,
        mapsEnabled,
        maintenanceMode,
        updatedAt: now,
        updatedBy: auth.currentUser?.email || "",
      };

      await setDoc(doc(db, "platformSettings", SETTINGS_ID), payload, { merge: true });

      await addDoc(collection(db, "auditLogs"), {
        action: "Platform Settings Updated",
        targetType: "platformSettings",
        targetId: SETTINGS_ID,
        details: "Admin updated global RoadLink platform settings.",
        severity: maintenanceMode ? "warning" : "success",
        adminEmail: auth.currentUser?.email || "",
        createdAt: now,
        resolved: !maintenanceMode,
      });

      setMessage("Platform settings saved successfully.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  function resetDefaults() {
    setPlatformFeePercent("12");
    setDriverPayoutPercent("88");
    setMinimumTripPrice("10");
    setPricePerMile("0.28");
    setPricePerMinute("0.05");
    setMaxSeatsPerRide("6");
    setCancellationFee("5");
    setSupportEmail("support@roadlink.com");
    setBookingEnabled(true);
    setDriverVerificationRequired(true);
    setSosEnabled(true);
    setChatEnabled(true);
    setWalletEnabled(true);
    setRewardsEnabled(true);
    setBusinessEnabled(true);
    setFleetEnabled(true);
    setStripeLiveMode(false);
    setMapsEnabled(true);
    setMaintenanceMode(false);
    setMessage("Default values loaded. Press Save Settings to apply.");
  }

  if (!adminAllowed) {
    return (
      <main className="page">
        <section className="locked">
          <h1>Platform <span>Settings</span></h1>
          <p>{message || "Checking admin access..."}</p>
          <Link href="/dashboard" className="navButton">Back to Dashboard</Link>
        </section>
        <Styles />
      </main>
    );
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topBar">
          <Link href="/admin-console" className="navButton">← Admin Console</Link>
          <Link href="/admin/analytics" className="navButton">Analytics</Link>
          <Link href="/admin/system-health" className="navButton">System Health</Link>
          <Link href="/admin/audit-logs" className="navButton">Audit Logs</Link>
          <Link href="/dashboard" className="navButton">Dashboard</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Control Panel</p>
            <h1>Platform <span>Settings</span></h1>
            <p className="subtitle">
              Control global pricing, commissions, modules, safety, payments, maps and operational rules without touching code.
            </p>
          </div>

          <div className={maintenanceMode ? "settingsOrb dangerOrb" : "settingsOrb"}>
            <strong>{metrics.healthScore}</strong>
            <span>Config Score</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="🧾" label="Platform Fee" value={`${metrics.fee}%`} />
          <Metric icon="🚗" label="Driver Payout" value={`${metrics.payout}%`} />
          <Metric icon="🧩" label="Active Modules" value={`${metrics.activeModules}/${metrics.totalModules}`} />
          <Metric icon={metrics.pricingValid ? "✅" : "⚠️"} label="Pricing Split" value={metrics.pricingValid ? "Valid" : "Check"} />
          <Metric icon="💵" label="Minimum Trip" value={`$${minimumTripPrice}`} />
          <Metric icon="🛣️" label="Price / Mile" value={`$${pricePerMile}`} />
          <Metric icon="⏱️" label="Price / Minute" value={`$${pricePerMinute}`} />
          <Metric icon={maintenanceMode ? "🚧" : "🟢"} label="Mode" value={maintenanceMode ? "Maintenance" : "Live"} />
        </section>

        <section className="grid">
          <section className="panel">
            <p className="eyebrow">Pricing Engine</p>
            <h2>Fare Rules</h2>

            <Field label="Platform Fee %" value={platformFeePercent} setValue={setPlatformFeePercent} />
            <Field label="Driver Payout %" value={driverPayoutPercent} setValue={setDriverPayoutPercent} />
            <Field label="Minimum Trip Price" value={minimumTripPrice} setValue={setMinimumTripPrice} />
            <Field label="Price Per Mile" value={pricePerMile} setValue={setPricePerMile} />
            <Field label="Price Per Minute" value={pricePerMinute} setValue={setPricePerMinute} />
            <Field label="Cancellation Fee" value={cancellationFee} setValue={setCancellationFee} />
            <Field label="Max Seats Per Ride" value={maxSeatsPerRide} setValue={setMaxSeatsPerRide} />

            {!metrics.pricingValid && (
              <div className="warningBox">
                <strong>Check pricing split</strong>
                <p>Platform fee and driver payout should add up to 100%.</p>
              </div>
            )}
          </section>

          <section className="panel">
            <p className="eyebrow">Modules</p>
            <h2>Feature Controls</h2>

            <Toggle label="Booking Enabled" value={bookingEnabled} setValue={setBookingEnabled} />
            <Toggle label="Driver Verification Required" value={driverVerificationRequired} setValue={setDriverVerificationRequired} />
            <Toggle label="SOS Enabled" value={sosEnabled} setValue={setSosEnabled} />
            <Toggle label="Chat Enabled" value={chatEnabled} setValue={setChatEnabled} />
            <Toggle label="Wallet Enabled" value={walletEnabled} setValue={setWalletEnabled} />
            <Toggle label="Rewards Enabled" value={rewardsEnabled} setValue={setRewardsEnabled} />
            <Toggle label="Business Accounts Enabled" value={businessEnabled} setValue={setBusinessEnabled} />
            <Toggle label="Fleet Management Enabled" value={fleetEnabled} setValue={setFleetEnabled} />
          </section>
        </section>

        <section className="grid">
          <section className="panel">
            <p className="eyebrow">Integrations</p>
            <h2>External Services</h2>

            <Toggle label="Google Maps Enabled" value={mapsEnabled} setValue={setMapsEnabled} />
            <Toggle label="Stripe Live Mode" value={stripeLiveMode} setValue={setStripeLiveMode} />

            <label>Support Email</label>
            <input
              value={supportEmail}
              onChange={(event) => setSupportEmail(event.target.value)}
              placeholder="support@roadlink.com"
            />

            <div className="infoBox">
              <strong>Stripe Mode</strong>
              <p>{stripeLiveMode ? "Live payments mode is enabled." : "Test mode is active until Stripe live keys are connected."}</p>
            </div>
          </section>

          <section className="panel">
            <p className="eyebrow">Operations</p>
            <h2>System Controls</h2>

            <Toggle label="Maintenance Mode" value={maintenanceMode} setValue={setMaintenanceMode} />

            <div className={maintenanceMode ? "dangerBox" : "infoBox"}>
              <strong>{maintenanceMode ? "Maintenance Mode Active" : "Platform Live"}</strong>
              <p>
                {maintenanceMode
                  ? "RoadLink is marked as under maintenance. Use this only during critical updates."
                  : "RoadLink is configured for normal operation."}
              </p>
            </div>

            <div className="actionRow">
              <button onClick={saveSettings} disabled={saving}>
                {saving ? "Saving..." : "Save Settings"}
              </button>

              <button className="secondaryButton" onClick={resetDefaults} disabled={saving}>
                Reset Defaults
              </button>
            </div>
          </section>
        </section>

        <section className="panel">
          <p className="eyebrow">Current Configuration</p>
          <h2>Settings Summary</h2>

          <div className="summaryGrid">
            <Info label="Last Updated" value={settings.updatedAt || "Not saved yet"} />
            <Info label="Updated By" value={settings.updatedBy || "Not available"} />
            <Info label="Platform Fee" value={`${platformFeePercent}%`} />
            <Info label="Driver Payout" value={`${driverPayoutPercent}%`} />
            <Info label="Minimum Price" value={`$${minimumTripPrice}`} />
            <Info label="Max Seats" value={maxSeatsPerRide} />
            <Info label="Stripe" value={stripeLiveMode ? "Live" : "Test"} />
            <Info label="Maintenance" value={maintenanceMode ? "Enabled" : "Disabled"} />
          </div>
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

function Field({
  label,
  value,
  setValue,
}: {
  label: string;
  value: string;
  setValue: (value: string) => void;
}) {
  return (
    <>
      <label>{label}</label>
      <input value={value} onChange={(event) => setValue(event.target.value)} inputMode="decimal" />
    </>
  );
}

function Toggle({
  label,
  value,
  setValue,
}: {
  label: string;
  value: boolean;
  setValue: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      className={value ? "toggle activeToggle" : "toggle"}
      onClick={() => setValue(!value)}
    >
      <span>{label}</span>
      <strong>{value ? "ON" : "OFF"}</strong>
    </button>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="summaryItem">
      <span>{label}</span>
      <strong>{value}</strong>
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

      .container {
        max-width: 1180px;
        margin: auto;
      }

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

      h1 {
        margin: 0 0 16px;
        font-size: 60px;
        line-height: 1;
      }

      h1 span,
      h2,
      .metric strong,
      .settingsOrb strong {
        color: #22c55e;
      }

      .subtitle,
      .locked p,
      .infoBox p,
      .dangerBox p,
      .warningBox p {
        color: #a1a1aa;
        max-width: 780px;
        line-height: 1.5;
        font-size: 18px;
        margin: 0;
      }

      .settingsOrb {
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

      .dangerOrb {
        background: rgba(239,68,68,0.13);
        border-color: rgba(239,68,68,0.35);
      }

      .dangerOrb strong {
        color: #fca5a5;
      }

      .settingsOrb strong {
        font-size: 42px;
      }

      .settingsOrb span {
        color: #d4d4d8;
        font-weight: 900;
        font-size: 12px;
      }

      .message {
        text-align: center;
        color: #22c55e;
        font-weight: 900;
      }

      .stats {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 14px;
        margin-bottom: 20px;
      }

      .metric {
        padding: 18px;
        border-radius: 22px;
      }

      .metricIcon {
        font-size: 24px;
        margin-bottom: 8px;
      }

      .metric span {
        display: block;
        color: #a1a1aa;
        font-size: 12px;
        font-weight: 900;
        margin-bottom: 6px;
      }

      .metric strong {
        font-size: 22px;
        overflow-wrap: anywhere;
      }

      .grid {
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

      .toggle {
        width: 100%;
        margin: 0 0 10px;
        padding: 14px 16px;
        border-radius: 18px;
        border: 1px solid rgba(255,255,255,0.1);
        background: rgba(255,255,255,0.04);
        color: white;
        display: flex;
        justify-content: space-between;
        gap: 14px;
        align-items: center;
        cursor: pointer;
        font-weight: 900;
      }

      .activeToggle {
        background: rgba(34,197,94,0.12);
        border-color: rgba(34,197,94,0.35);
      }

      .toggle strong {
        color: #22c55e;
      }

      .warningBox,
      .infoBox,
      .dangerBox {
        margin-top: 18px;
        padding: 18px;
        border-radius: 20px;
      }

      .warningBox {
        background: rgba(234,179,8,0.1);
        border: 1px solid rgba(234,179,8,0.35);
      }

      .infoBox {
        background: rgba(34,197,94,0.1);
        border: 1px solid rgba(34,197,94,0.3);
      }

      .dangerBox {
        background: rgba(239,68,68,0.1);
        border: 1px solid rgba(239,68,68,0.35);
      }

      .warningBox strong {
        color: #fde68a;
      }

      .infoBox strong {
        color: #22c55e;
      }

      .dangerBox strong {
        color: #fca5a5;
      }

      .actionRow {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin-top: 18px;
      }

      button {
        width: 100%;
        padding: 15px;
        border-radius: 999px;
        border: none;
        background: linear-gradient(135deg, #22c55e, #16a34a);
        color: white;
        font-weight: 900;
        cursor: pointer;
      }

      .secondaryButton {
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.12);
      }

      button:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      .summaryGrid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
      }

      .summaryItem {
        padding: 14px;
        border-radius: 16px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.09);
      }

      .summaryItem span {
        display: block;
        color: #a1a1aa;
        font-size: 12px;
        font-weight: 900;
        margin-bottom: 6px;
      }

      .summaryItem strong {
        display: block;
        color: white;
        overflow-wrap: anywhere;
      }

      @media (max-width: 1000px) {
        .hero,
        .grid {
          grid-template-columns: 1fr;
          flex-direction: column;
          align-items: flex-start;
        }

        .stats,
        .summaryGrid,
        .actionRow {
          grid-template-columns: 1fr;
        }

        h1 {
          font-size: 44px;
        }
      }

      @media (max-width: 600px) {
        .page {
          padding: 16px;
          padding-bottom: 120px;
        }

        .hero,
        .panel {
          padding: 22px;
          border-radius: 26px;
        }
      }
    `}</style>
  );
    }
