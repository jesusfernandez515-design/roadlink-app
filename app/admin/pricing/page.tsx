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
  setDoc,
} from "firebase/firestore";
import { auth, db } from "../../../lib/firebase";

type UserProfile = {
  id: string;
  email?: string;
  role?: string;
  admin?: boolean;
};

type PricingSettings = {
  baseFare?: number;
  pricePerMile?: number;
  pricePerMinute?: number;
  minimumFare?: number;
  platformFeePercent?: number;
  driverPayoutPercent?: number;
  surgeEnabled?: boolean;
  surgeMultiplier?: number;
  nightEnabled?: boolean;
  nightMultiplier?: number;
  trafficEnabled?: boolean;
  trafficMultiplier?: number;
  weatherEnabled?: boolean;
  weatherMultiplier?: number;
  eventEnabled?: boolean;
  eventMultiplier?: number;
  cityAdjustment?: number;
  updatedAt?: string;
  updatedBy?: string;
};

type PricingLog = {
  id: string;
  action?: string;
  details?: string;
  adminEmail?: string;
  createdAt?: string;
};

const SETTINGS_ID = "global";

export default function AdminPricingPage() {
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [message, setMessage] = useState("Loading pricing center...");
  const [saving, setSaving] = useState(false);
  const [logs, setLogs] = useState<PricingLog[]>([]);

  const [baseFare, setBaseFare] = useState("3");
  const [pricePerMile, setPricePerMile] = useState("0.28");
  const [pricePerMinute, setPricePerMinute] = useState("0.05");
  const [minimumFare, setMinimumFare] = useState("10");
  const [platformFeePercent, setPlatformFeePercent] = useState("12");
  const [driverPayoutPercent, setDriverPayoutPercent] = useState("88");

  const [surgeEnabled, setSurgeEnabled] = useState(true);
  const [surgeMultiplier, setSurgeMultiplier] = useState("1.5");
  const [nightEnabled, setNightEnabled] = useState(false);
  const [nightMultiplier, setNightMultiplier] = useState("1.2");
  const [trafficEnabled, setTrafficEnabled] = useState(false);
  const [trafficMultiplier, setTrafficMultiplier] = useState("1.15");
  const [weatherEnabled, setWeatherEnabled] = useState(false);
  const [weatherMultiplier, setWeatherMultiplier] = useState("1.1");
  const [eventEnabled, setEventEnabled] = useState(false);
  const [eventMultiplier, setEventMultiplier] = useState("1.25");
  const [cityAdjustment, setCityAdjustment] = useState("0");

  const [simMiles, setSimMiles] = useState("40");
  const [simMinutes, setSimMinutes] = useState("55");
  const [simSeats, setSimSeats] = useState("1");

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

    const unsubscribeSettings = onSnapshot(
      doc(db, "pricingSettings", SETTINGS_ID),
      (snapshot) => {
        if (!snapshot.exists()) {
          setMessage("");
          return;
        }

        const data = snapshot.data() as PricingSettings;

        setBaseFare(String(data.baseFare ?? 3));
        setPricePerMile(String(data.pricePerMile ?? 0.28));
        setPricePerMinute(String(data.pricePerMinute ?? 0.05));
        setMinimumFare(String(data.minimumFare ?? 10));
        setPlatformFeePercent(String(data.platformFeePercent ?? 12));
        setDriverPayoutPercent(String(data.driverPayoutPercent ?? 88));

        setSurgeEnabled(data.surgeEnabled ?? true);
        setSurgeMultiplier(String(data.surgeMultiplier ?? 1.5));
        setNightEnabled(data.nightEnabled ?? false);
        setNightMultiplier(String(data.nightMultiplier ?? 1.2));
        setTrafficEnabled(data.trafficEnabled ?? false);
        setTrafficMultiplier(String(data.trafficMultiplier ?? 1.15));
        setWeatherEnabled(data.weatherEnabled ?? false);
        setWeatherMultiplier(String(data.weatherMultiplier ?? 1.1));
        setEventEnabled(data.eventEnabled ?? false);
        setEventMultiplier(String(data.eventMultiplier ?? 1.25));
        setCityAdjustment(String(data.cityAdjustment ?? 0));

        setMessage("");
      },
      (error) => setMessage(error.message)
    );

    const unsubscribeLogs = onSnapshot(
      query(collection(db, "pricingLogs")),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as PricingLog[];

        data.sort((a, b) =>
          String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
        );

        setLogs(data);
      },
      (error) => setMessage(error.message)
    );

    return () => {
      unsubscribeSettings();
      unsubscribeLogs();
    };
  }, [adminAllowed]);

  const simulator = useMemo(() => {
    const miles = Number(simMiles || 0);
    const minutes = Number(simMinutes || 0);
    const seats = Math.max(1, Number(simSeats || 1));

    const base =
      Number(baseFare || 0) +
      miles * Number(pricePerMile || 0) +
      minutes * Number(pricePerMinute || 0) +
      Number(cityAdjustment || 0);

    const minimumApplied = Math.max(base, Number(minimumFare || 0));

    let multiplier = 1;

    if (surgeEnabled) multiplier *= Number(surgeMultiplier || 1);
    if (nightEnabled) multiplier *= Number(nightMultiplier || 1);
    if (trafficEnabled) multiplier *= Number(trafficMultiplier || 1);
    if (weatherEnabled) multiplier *= Number(weatherMultiplier || 1);
    if (eventEnabled) multiplier *= Number(eventMultiplier || 1);

    const total = Number((minimumApplied * multiplier * seats).toFixed(2));
    const platformFee = Number((total * (Number(platformFeePercent || 0) / 100)).toFixed(2));
    const driverPayout = Number((total * (Number(driverPayoutPercent || 0) / 100)).toFixed(2));

    return {
      miles,
      minutes,
      seats,
      base: Number(base.toFixed(2)),
      minimumApplied: Number(minimumApplied.toFixed(2)),
      multiplier: Number(multiplier.toFixed(2)),
      total,
      platformFee,
      driverPayout,
      splitValid:
        Number(platformFeePercent || 0) + Number(driverPayoutPercent || 0) === 100,
    };
  }, [
    simMiles,
    simMinutes,
    simSeats,
    baseFare,
    pricePerMile,
    pricePerMinute,
    minimumFare,
    platformFeePercent,
    driverPayoutPercent,
    surgeEnabled,
    surgeMultiplier,
    nightEnabled,
    nightMultiplier,
    trafficEnabled,
    trafficMultiplier,
    weatherEnabled,
    weatherMultiplier,
    eventEnabled,
    eventMultiplier,
    cityAdjustment,
  ]);

  const healthScore = useMemo(() => {
    return Math.max(
      0,
      Math.min(
        100,
        100 -
          (!simulator.splitValid ? 25 : 0) -
          (Number(minimumFare || 0) <= 0 ? 10 : 0) -
          (Number(pricePerMile || 0) <= 0 ? 10 : 0) -
          (Number(driverPayoutPercent || 0) < 50 ? 20 : 0)
      )
    );
  }, [simulator.splitValid, minimumFare, pricePerMile, driverPayoutPercent]);

  function money(value: number) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  async function savePricing() {
    try {
      setSaving(true);
      setMessage("");

      const now = new Date().toISOString();

      const payload: PricingSettings = {
        baseFare: Number(baseFare || 0),
        pricePerMile: Number(pricePerMile || 0),
        pricePerMinute: Number(pricePerMinute || 0),
        minimumFare: Number(minimumFare || 0),
        platformFeePercent: Number(platformFeePercent || 0),
        driverPayoutPercent: Number(driverPayoutPercent || 0),
        surgeEnabled,
        surgeMultiplier: Number(surgeMultiplier || 1),
        nightEnabled,
        nightMultiplier: Number(nightMultiplier || 1),
        trafficEnabled,
        trafficMultiplier: Number(trafficMultiplier || 1),
        weatherEnabled,
        weatherMultiplier: Number(weatherMultiplier || 1),
        eventEnabled,
        eventMultiplier: Number(eventMultiplier || 1),
        cityAdjustment: Number(cityAdjustment || 0),
        updatedAt: now,
        updatedBy: auth.currentUser?.email || "",
      };

      await setDoc(doc(db, "pricingSettings", SETTINGS_ID), payload, { merge: true });

      await addDoc(collection(db, "pricingLogs"), {
        action: "Pricing Updated",
        details: `Base ${money(payload.baseFare || 0)}, mile ${money(
          payload.pricePerMile || 0
        )}, minimum ${money(payload.minimumFare || 0)}, platform fee ${
          payload.platformFeePercent
        }%.`,
        adminEmail: auth.currentUser?.email || "",
        createdAt: now,
      });

      await addDoc(collection(db, "auditLogs"), {
        action: "Pricing Settings Updated",
        targetType: "pricingSettings",
        targetId: SETTINGS_ID,
        details: "Admin updated RoadLink pricing rules.",
        severity: simulator.splitValid ? "success" : "warning",
        adminEmail: auth.currentUser?.email || "",
        createdAt: now,
        resolved: simulator.splitValid,
      });

      setMessage("Pricing settings saved successfully.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not save pricing.");
    } finally {
      setSaving(false);
    }
  }

  function resetDefaults() {
    setBaseFare("3");
    setPricePerMile("0.28");
    setPricePerMinute("0.05");
    setMinimumFare("10");
    setPlatformFeePercent("12");
    setDriverPayoutPercent("88");
    setSurgeEnabled(true);
    setSurgeMultiplier("1.5");
    setNightEnabled(false);
    setNightMultiplier("1.2");
    setTrafficEnabled(false);
    setTrafficMultiplier("1.15");
    setWeatherEnabled(false);
    setWeatherMultiplier("1.1");
    setEventEnabled(false);
    setEventMultiplier("1.25");
    setCityAdjustment("0");
    setMessage("Default pricing loaded. Press Save Pricing to apply.");
  }

  if (!adminAllowed) {
    return (
      <main className="page">
        <section className="locked">
          <h1>Pricing <span>Center</span></h1>
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
          <Link href="/admin/platform-settings" className="navButton">Platform Settings</Link>
          <Link href="/admin/finance" className="navButton">Finance</Link>
          <Link href="/admin/invoices" className="navButton">Invoices</Link>
          <Link href="/dashboard" className="navButton">Dashboard</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Fare Engine</p>
            <h1>Pricing <span>Center</span></h1>
            <p className="subtitle">
              Control base fares, price per mile, price per minute, platform commission,
              driver payout, multipliers and dynamic pricing rules.
            </p>
          </div>

          <div className={healthScore >= 80 ? "priceOrb" : "priceOrb dangerOrb"}>
            <strong>{healthScore}</strong>
            <span>Pricing Score</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="🚗" label="Base Fare" value={`$${baseFare}`} />
          <Metric icon="🛣️" label="Per Mile" value={`$${pricePerMile}`} />
          <Metric icon="⏱️" label="Per Minute" value={`$${pricePerMinute}`} />
          <Metric icon="💵" label="Minimum Fare" value={`$${minimumFare}`} />
          <Metric icon="🧾" label="Platform Fee" value={`${platformFeePercent}%`} />
          <Metric icon="👨‍✈️" label="Driver Payout" value={`${driverPayoutPercent}%`} />
          <Metric icon="📈" label="Active Multiplier" value={`${simulator.multiplier}x`} />
          <Metric icon={simulator.splitValid ? "✅" : "⚠️"} label="Split" value={simulator.splitValid ? "Valid" : "Check"} />
        </section>

        <section className="grid">
          <section className="panel">
            <p className="eyebrow">Core Pricing</p>
            <h2>Fare Rules</h2>

            <Field label="Base Fare" value={baseFare} setValue={setBaseFare} />
            <Field label="Price Per Mile" value={pricePerMile} setValue={setPricePerMile} />
            <Field label="Price Per Minute" value={pricePerMinute} setValue={setPricePerMinute} />
            <Field label="Minimum Fare" value={minimumFare} setValue={setMinimumFare} />
            <Field label="Platform Fee %" value={platformFeePercent} setValue={setPlatformFeePercent} />
            <Field label="Driver Payout %" value={driverPayoutPercent} setValue={setDriverPayoutPercent} />
            <Field label="City Adjustment" value={cityAdjustment} setValue={setCityAdjustment} />

            {!simulator.splitValid && (
              <div className="warningBox">
                <strong>Split warning</strong>
                <p>Platform fee and driver payout should equal 100%.</p>
              </div>
            )}
          </section>

          <section className="panel">
            <p className="eyebrow">Dynamic Pricing</p>
            <h2>Multipliers</h2>

            <Toggle label="Surge Pricing" value={surgeEnabled} setValue={setSurgeEnabled} />
            <Field label="Surge Multiplier" value={surgeMultiplier} setValue={setSurgeMultiplier} />

            <Toggle label="Night Pricing" value={nightEnabled} setValue={setNightEnabled} />
            <Field label="Night Multiplier" value={nightMultiplier} setValue={setNightMultiplier} />

            <Toggle label="Traffic Multiplier" value={trafficEnabled} setValue={setTrafficEnabled} />
            <Field label="Traffic Multiplier" value={trafficMultiplier} setValue={setTrafficMultiplier} />

            <Toggle label="Weather Multiplier" value={weatherEnabled} setValue={setWeatherEnabled} />
            <Field label="Weather Multiplier" value={weatherMultiplier} setValue={setWeatherMultiplier} />

            <Toggle label="Event Multiplier" value={eventEnabled} setValue={setEventEnabled} />
            <Field label="Event Multiplier" value={eventMultiplier} setValue={setEventMultiplier} />
          </section>
        </section>

        <section className="grid">
          <section className="panel">
            <p className="eyebrow">Simulator</p>
            <h2>Price Preview</h2>

            <Field label="Miles" value={simMiles} setValue={setSimMiles} />
            <Field label="Minutes" value={simMinutes} setValue={setSimMinutes} />
            <Field label="Seats" value={simSeats} setValue={setSimSeats} />

            <div className="simBox">
              <Info label="Base Calculation" value={money(simulator.base)} />
              <Info label="After Minimum" value={money(simulator.minimumApplied)} />
              <Info label="Multiplier" value={`${simulator.multiplier}x`} />
              <Info label="Passenger Total" value={money(simulator.total)} />
              <Info label="RoadLink Fee" value={money(simulator.platformFee)} />
              <Info label="Driver Payout" value={money(simulator.driverPayout)} />
            </div>
          </section>

          <section className="panel">
            <p className="eyebrow">Actions</p>
            <h2>Save Pricing</h2>

            <div className="infoBox">
              <strong>Pricing Engine Status</strong>
              <p>
                {healthScore >= 80
                  ? "Your pricing configuration looks ready for normal operation."
                  : "Review pricing split, minimum fare, and driver payout before launch."}
              </p>
            </div>

            <div className="actionRow">
              <button onClick={savePricing} disabled={saving}>
                {saving ? "Saving..." : "Save Pricing"}
              </button>

              <button className="secondaryButton" onClick={resetDefaults} disabled={saving}>
                Reset Defaults
              </button>
            </div>

            <div className="history">
              <p className="eyebrow">Pricing History</p>

              {logs.length === 0 ? (
                <div className="empty">
                  <h3>No pricing logs yet</h3>
                  <p>Changes to pricing will appear here.</p>
                </div>
              ) : (
                <div className="logList">
                  {logs.slice(0, 8).map((log) => (
                    <div key={log.id} className="logItem">
                      <strong>{log.action || "Pricing Update"}</strong>
                      <p>{log.details || "No details available."}</p>
                      <small>{log.adminEmail || "Admin"} · {log.createdAt ? new Date(log.createdAt).toLocaleString() : "Recently"}</small>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
    <div className="info">
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
      .priceOrb strong {
        color: #22c55e;
      }

      .subtitle,
      .locked p,
      .warningBox p,
      .infoBox p,
      .empty p,
      .logItem p,
      .logItem small {
        color: #a1a1aa;
        max-width: 780px;
        line-height: 1.5;
        font-size: 18px;
        margin: 0;
      }

      .priceOrb {
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

      .priceOrb strong {
        font-size: 42px;
      }

      .priceOrb span {
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
      .infoBox {
        margin-top: 18px;
        padding: 18px;
        border-radius: 20px;
      }

      .warningBox {
        background: rgba(234,179,8,0.1);
        border: 1px solid rgba(234,179,8,0.35);
      }

      .infoBox,
      .simBox {
        background: rgba(34,197,94,0.08);
        border: 1px solid rgba(34,197,94,0.28);
        border-radius: 20px;
        padding: 18px;
        margin-top: 18px;
      }

      .warningBox strong {
        color: #fde68a;
      }

      .infoBox strong {
        color: #22c55e;
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

      .info {
        padding: 13px;
        border-radius: 16px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.09);
        margin-bottom: 10px;
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

      .history {
        margin-top: 24px;
      }

      .logList {
        display: grid;
        gap: 10px;
      }

      .logItem,
      .empty {
        padding: 14px;
        border-radius: 16px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.09);
      }

      .logItem strong {
        display: block;
        margin-bottom: 5px;
      }

      .logItem p,
      .logItem small {
        font-size: 13px;
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
