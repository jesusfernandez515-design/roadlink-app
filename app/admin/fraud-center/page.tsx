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
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "../../../lib/firebase";

type UserProfile = {
  id: string;
  email?: string;
  name?: string;
  role?: string;
  admin?: boolean;
  online?: boolean;
  verified?: boolean;
  driverVerified?: boolean;
  suspended?: boolean;
  status?: string;
  phone?: string;
  deviceId?: string;
  createdAt?: any;
};

type Booking = {
  id: string;
  userId?: string;
  passengerId?: string;
  passengerEmail?: string;
  driverId?: string;
  driverEmail?: string;
  status?: string;
  price?: number;
  seatsBooked?: number;
  createdAt?: any;
};

type Ride = {
  id: string;
  driverId?: string;
  driverEmail?: string;
  status?: string;
  from?: string;
  to?: string;
  price?: number;
  createdAt?: any;
};

type Payout = {
  id: string;
  userId?: string;
  email?: string;
  driverEmail?: string;
  amount?: number;
  status?: string;
  createdAt?: any;
};

type EmergencyAlert = {
  id: string;
  userId?: string;
  userEmail?: string;
  status?: string;
  priority?: string;
  createdAt?: any;
};

type FraudCase = {
  id: string;
  userId?: string;
  userEmail?: string;
  riskScore?: number;
  status?: string;
  reason?: string;
  createdAt?: any;
};

type RiskUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  suspended: boolean;
  riskScore: number;
  riskLevel: string;
  reasons: string[];
  bookings: number;
  cancellations: number;
  rides: number;
  payouts: number;
  payoutAmount: number;
  sosAlerts: number;
  deviceMatches: number;
  createdAt?: any;
};

type FilterKey = "all" | "high" | "medium" | "low" | "suspended" | "reviewed";

export default function AdminFraudCenterPage() {
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);
  const [cases, setCases] = useState<FraudCase[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [status, setStatus] = useState("Loading fraud center...");
  const [savingId, setSavingId] = useState("");

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

          setStatus(allowed ? "" : "Access denied. Admin account required.");
        },
        (error) => setStatus(error.message)
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
    });

    const unsubBookings = onSnapshot(query(collection(db, "bookings")), (snapshot) => {
      setBookings(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as Booking[]);
    });

    const unsubRides = onSnapshot(query(collection(db, "rides")), (snapshot) => {
      setRides(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as Ride[]);
    });

    const unsubPayouts = onSnapshot(query(collection(db, "payoutRequests")), (snapshot) => {
      setPayouts(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as Payout[]);
    });

    const unsubAlerts = onSnapshot(query(collection(db, "emergencyAlerts")), (snapshot) => {
      setAlerts(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as EmergencyAlert[]);
    });

    const unsubCases = onSnapshot(query(collection(db, "fraudCases")), (snapshot) => {
      setCases(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as FraudCase[]);
    });

    return () => {
      unsubUsers();
      unsubBookings();
      unsubRides();
      unsubPayouts();
      unsubAlerts();
      unsubCases();
    };
  }, [adminAllowed]);

  function clean(value?: string) {
    return String(value || "").toLowerCase();
  }

  function money(value?: number) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  function formatDate(value?: any) {
    if (!value) return "Recently";

    try {
      const date = value?.toDate ? value.toDate() : new Date(value);
      if (Number.isNaN(date.getTime())) return "Recently";

      return date.toLocaleString([], {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Recently";
    }
  }

  const riskUsers = useMemo(() => {
    return users.map((user) => {
      const userEmail = user.email || "";

      const userBookings = bookings.filter(
        (booking) =>
          booking.passengerId === user.id ||
          booking.driverId === user.id ||
          booking.passengerEmail === userEmail ||
          booking.driverEmail === userEmail
      );

      const userRides = rides.filter(
        (ride) => ride.driverId === user.id || ride.driverEmail === userEmail
      );

      const userPayouts = payouts.filter(
        (payout) =>
          payout.userId === user.id ||
          payout.email === userEmail ||
          payout.driverEmail === userEmail
      );

      const userAlerts = alerts.filter(
        (alert) => alert.userId === user.id || alert.userEmail === userEmail
      );

      const cancellations = userBookings.filter((booking) =>
        ["cancelled", "rejected"].includes(clean(booking.status))
      ).length;

      const payoutAmount = userPayouts.reduce(
        (total, payout) => total + Number(payout.amount || 0),
        0
      );

      const deviceMatches =
        user.deviceId
          ? users.filter((item) => item.id !== user.id && item.deviceId === user.deviceId).length
          : 0;

      const reasons: string[] = [];
      let score = 0;

      if (cancellations >= 3) {
        score += 25;
        reasons.push("High cancellation activity");
      }

      if (userPayouts.length >= 3 && payoutAmount > 500) {
        score += 20;
        reasons.push("Multiple payout requests");
      }

      if (deviceMatches > 0) {
        score += 25;
        reasons.push("Device shared with other accounts");
      }

      if (userAlerts.length >= 2) {
        score += 10;
        reasons.push("Multiple safety incidents");
      }

      if (!user.verified && !user.driverVerified) {
        score += 10;
        reasons.push("Account not verified");
      }

      if (user.suspended || clean(user.status) === "suspended") {
        score += 30;
        reasons.push("Account suspended");
      }

      if (userBookings.length === 0 && userPayouts.length > 0) {
        score += 35;
        reasons.push("Payout activity without bookings");
      }

      if (score === 0) {
        reasons.push("No major risk signals detected");
      }

      const riskScore = Math.min(100, score);
      const riskLevel =
        riskScore >= 70 ? "High" : riskScore >= 35 ? "Medium" : "Low";

      return {
        id: user.id,
        name: user.name || user.email || "RoadLink User",
        email: user.email || "No email",
        role: user.role || "user",
        suspended: Boolean(user.suspended || clean(user.status) === "suspended"),
        riskScore,
        riskLevel,
        reasons,
        bookings: userBookings.length,
        cancellations,
        rides: userRides.length,
        payouts: userPayouts.length,
        payoutAmount,
        sosAlerts: userAlerts.length,
        deviceMatches,
        createdAt: user.createdAt,
      } as RiskUser;
    });
  }, [users, bookings, rides, payouts, alerts]);

  const reviewedIds = useMemo(() => {
    return new Set(cases.filter((item) => clean(item.status) === "reviewed").map((item) => item.userId || ""));
  }, [cases]);

  const filteredUsers = useMemo(() => {
    const text = search.trim().toLowerCase();

    return riskUsers
      .filter((user) => {
        const matchesSearch =
          !text ||
          user.name.toLowerCase().includes(text) ||
          user.email.toLowerCase().includes(text) ||
          user.id.toLowerCase().includes(text);

        const matchesFilter =
          filter === "all" ||
          (filter === "high" && user.riskLevel === "High") ||
          (filter === "medium" && user.riskLevel === "Medium") ||
          (filter === "low" && user.riskLevel === "Low") ||
          (filter === "suspended" && user.suspended) ||
          (filter === "reviewed" && reviewedIds.has(user.id));

        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => b.riskScore - a.riskScore);
  }, [riskUsers, search, filter, reviewedIds]);

  const stats = useMemo(() => {
    return {
      users: riskUsers.length,
      high: riskUsers.filter((item) => item.riskLevel === "High").length,
      medium: riskUsers.filter((item) => item.riskLevel === "Medium").length,
      low: riskUsers.filter((item) => item.riskLevel === "Low").length,
      suspended: riskUsers.filter((item) => item.suspended).length,
      reviewed: reviewedIds.size,
      deviceMatches: riskUsers.reduce((total, item) => total + item.deviceMatches, 0),
      totalPayoutRisk: riskUsers.reduce((total, item) => total + item.payoutAmount, 0),
    };
  }, [riskUsers, reviewedIds]);

  async function createFraudCase(user: RiskUser, caseStatus: "open" | "reviewed") {
    try {
      setSavingId(user.id);
      setStatus("");

      const now = new Date().toISOString();

      await addDoc(collection(db, "fraudCases"), {
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        riskScore: user.riskScore,
        riskLevel: user.riskLevel,
        reason: user.reasons.join(", "),
        status: caseStatus,
        reviewedBy: auth.currentUser?.uid || "",
        reviewedByEmail: auth.currentUser?.email || "",
        createdAt: now,
        updatedAt: now,
      });

      setStatus(caseStatus === "reviewed" ? "Case marked as reviewed." : "Fraud case opened.");
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "Could not create fraud case.");
    } finally {
      setSavingId("");
    }
  }

  async function suspendUser(user: RiskUser) {
    const confirmed = confirm(`Suspend ${user.email}?`);
    if (!confirmed) return;

    try {
      setSavingId(user.id);
      setStatus("");

      const now = new Date().toISOString();

      await setDoc(
        doc(db, "users", user.id),
        {
          suspended: true,
          status: "suspended",
          suspendedAt: now,
          suspendedBy: auth.currentUser?.uid || "",
          updatedAt: now,
        },
        { merge: true }
      );

      await createFraudCase(user, "open");

      await addDoc(collection(db, "notifications"), {
        userId: user.id,
        type: "security",
        title: "Account Under Review",
        message: "Your RoadLink account has been restricted while our team reviews security activity.",
        read: false,
        createdAt: now,
        actionUrl: "/support",
      });

      setStatus("User suspended and fraud case opened.");
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "Could not suspend user.");
    } finally {
      setSavingId("");
    }
  }

  async function restoreUser(user: RiskUser) {
    try {
      setSavingId(user.id);
      setStatus("");

      await updateDoc(doc(db, "users", user.id), {
        suspended: false,
        status: "active",
        restoredAt: new Date().toISOString(),
        restoredBy: auth.currentUser?.uid || "",
        updatedAt: new Date().toISOString(),
      });

      setStatus("User restored.");
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "Could not restore user.");
    } finally {
      setSavingId("");
    }
  }

  function riskClass(level: string) {
    if (level === "High") return "risk high";
    if (level === "Medium") return "risk medium";
    return "risk low";
  }

  if (!adminAllowed) {
    return (
      <main className="page">
        <section className="locked">
          <h1>Fraud <span>Center</span></h1>
          <p>{status || "Checking admin access..."}</p>
          <Link href="/dashboard" className="navButton">Back to Dashboard</Link>
        </section>
        <PageStyles />
      </main>
    );
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topBar">
          <Link href="/admin-console" className="navButton">← Admin Console</Link>
          <Link href="/admin/analytics" className="navButton">Enterprise Analytics</Link>
          <Link href="/admin-sos" className="navButton">Admin SOS</Link>
          <Link href="/support" className="navButton">Support</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Trust & Safety</p>
            <h1>Fraud <span>Detection Center</span></h1>
            <p className="subtitle">
              Detect suspicious accounts, shared devices, payout risk, cancellation abuse,
              security alerts and user behavior patterns.
            </p>
          </div>

          <div className="riskOrb">
            <strong>{stats.high}</strong>
            <span>High Risk</span>
          </div>
        </section>

        {status && <p className="status">{status}</p>}

        <section className="stats">
          <Metric icon="👥" label="Users Scanned" value={String(stats.users)} />
          <Metric icon="🔴" label="High Risk" value={String(stats.high)} />
          <Metric icon="🟡" label="Medium Risk" value={String(stats.medium)} />
          <Metric icon="🟢" label="Low Risk" value={String(stats.low)} />
          <Metric icon="🚫" label="Suspended" value={String(stats.suspended)} />
          <Metric icon="✅" label="Reviewed" value={String(stats.reviewed)} />
          <Metric icon="📱" label="Device Matches" value={String(stats.deviceMatches)} />
          <Metric icon="💳" label="Payout Exposure" value={money(stats.totalPayoutRisk)} />
        </section>

        <section className="controls">
          <div>
            <p className="eyebrow">Investigation Console</p>
            <h2>Search Risk Signals</h2>
          </div>

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, email or user ID..."
          />

          <div className="filterGrid">
            {[
              ["all", "🌐 All"],
              ["high", "🔴 High"],
              ["medium", "🟡 Medium"],
              ["low", "🟢 Low"],
              ["suspended", "🚫 Suspended"],
              ["reviewed", "✅ Reviewed"],
            ].map(([key, label]) => (
              <button
                key={key}
                className={filter === key ? "filterButton activeFilter" : "filterButton"}
                onClick={() => setFilter(key as FilterKey)}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">Risk Table</p>
              <h2>{filteredUsers.length} Users Showing</h2>
            </div>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="empty">
              <div className="emptyIcon">🛡️</div>
              <h3>No matching users</h3>
              <p>Adjust the search or filter to find fraud signals.</p>
            </div>
          ) : (
            <div className="list">
              {filteredUsers.map((user) => (
                <article key={user.id} className="riskCard">
                  <div className="riskTop">
                    <div className="avatar">{user.name.charAt(0).toUpperCase()}</div>

                    <div>
                      <h3>{user.name}</h3>
                      <p>{user.email}</p>
                      <small>ID: {user.id}</small>
                    </div>

                    <div className={riskClass(user.riskLevel)}>
                      <strong>{user.riskScore}</strong>
                      <span>{user.riskLevel}</span>
                    </div>
                  </div>

                  <div className="reasonBox">
                    {user.reasons.map((reason) => (
                      <span key={reason}>{reason}</span>
                    ))}
                  </div>

                  <div className="infoGrid">
                    <Info label="Bookings" value={String(user.bookings)} />
                    <Info label="Cancellations" value={String(user.cancellations)} />
                    <Info label="Rides" value={String(user.rides)} />
                    <Info label="Payouts" value={String(user.payouts)} />
                    <Info label="Payout Amount" value={money(user.payoutAmount)} />
                    <Info label="SOS Alerts" value={String(user.sosAlerts)} />
                    <Info label="Device Matches" value={String(user.deviceMatches)} />
                    <Info label="Created" value={formatDate(user.createdAt)} />
                  </div>

                  <div className="actions">
                    <button
                      onClick={() => createFraudCase(user, "open")}
                      disabled={savingId === user.id}
                    >
                      Open Case
                    </button>

                    <button
                      onClick={() => createFraudCase(user, "reviewed")}
                      disabled={savingId === user.id}
                    >
                      Mark Reviewed
                    </button>

                    {user.suspended ? (
                      <button
                        className="restoreButton"
                        onClick={() => restoreUser(user)}
                        disabled={savingId === user.id}
                      >
                        Restore User
                      </button>
                    ) : (
                      <button
                        className="dangerButton"
                        onClick={() => suspendUser(user)}
                        disabled={savingId === user.id}
                      >
                        Suspend User
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <p className="eyebrow">Investigation History</p>
          <h2>Fraud Cases</h2>

          {cases.length === 0 ? (
            <div className="empty">
              <div className="emptyIcon">📁</div>
              <h3>No fraud cases yet</h3>
              <p>Cases opened or reviewed by admins will appear here.</p>
            </div>
          ) : (
            <div className="caseList">
              {cases
                .slice()
                .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
                .map((item) => (
                  <div key={item.id} className="caseCard">
                    <div>
                      <strong>{item.userEmail || "Unknown user"}</strong>
                      <p>{item.reason || "No reason added"}</p>
                    </div>

                    <span>{item.status || "open"} · {item.riskScore || 0}</span>
                  </div>
                ))}
            </div>
          )}
        </section>
      </section>

      <PageStyles />
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

function PageStyles() {
  return (
    <style>{`
      * { box-sizing: border-box; }

      .page {
        min-height: 100vh;
        padding: 24px;
        padding-bottom: 120px;
        color: white;
        font-family: Arial, sans-serif;
        background:
          radial-gradient(circle at top right, rgba(239,68,68,0.22), transparent 35%),
          radial-gradient(circle at bottom left, rgba(34,197,94,0.13), transparent 35%),
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
      .controls,
      .panel,
      .riskCard,
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
        color: #ef4444;
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
      .riskOrb strong {
        color: #ef4444;
      }

      .subtitle,
      .locked p,
      .empty p {
        color: #a1a1aa;
        max-width: 780px;
        line-height: 1.5;
        font-size: 18px;
        margin: 0;
      }

      .riskOrb {
        min-width: 130px;
        height: 130px;
        border-radius: 50%;
        background: rgba(239,68,68,0.13);
        border: 1px solid rgba(239,68,68,0.35);
        display: flex;
        justify-content: center;
        align-items: center;
        flex-direction: column;
        text-align: center;
      }

      .riskOrb strong {
        font-size: 42px;
      }

      .riskOrb span {
        color: #fca5a5;
        font-weight: 900;
      }

      .status {
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

      .controls,
      .panel {
        border-radius: 30px;
        padding: 30px;
        margin-bottom: 20px;
      }

      input {
        width: 100%;
        padding: 16px;
        border-radius: 18px;
        border: 1px solid rgba(255,255,255,0.12);
        background: rgba(255,255,255,0.05);
        color: white;
        font-size: 16px;
        outline: none;
        margin: 16px 0;
      }

      .filterGrid {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 10px;
      }

      .filterButton,
      button {
        border-radius: 999px;
        padding: 13px 15px;
        border: 1px solid rgba(255,255,255,0.1);
        background: rgba(255,255,255,0.05);
        color: white;
        font-weight: 900;
        cursor: pointer;
      }

      .activeFilter {
        color: #ef4444;
        background: rgba(239,68,68,0.12);
        border-color: rgba(239,68,68,0.4);
      }

      button:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      .sectionHeader {
        margin-bottom: 20px;
      }

      .list {
        display: grid;
        gap: 16px;
      }

      .riskCard {
        border-radius: 26px;
        padding: 22px;
        box-shadow: none;
      }

      .riskTop {
        display: grid;
        grid-template-columns: auto 1fr auto;
        gap: 16px;
        align-items: center;
        margin-bottom: 16px;
      }

      .avatar {
        width: 58px;
        height: 58px;
        border-radius: 50%;
        background: linear-gradient(135deg, #ef4444, #991b1b);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        font-weight: 900;
      }

      .riskTop h3 {
        margin: 0 0 5px;
        font-size: 22px;
        overflow-wrap: anywhere;
      }

      .riskTop p,
      .riskTop small {
        color: #a1a1aa;
        margin: 0;
        overflow-wrap: anywhere;
      }

      .risk {
        min-width: 86px;
        padding: 12px;
        border-radius: 18px;
        text-align: center;
      }

      .risk strong {
        display: block;
        font-size: 28px;
      }

      .risk span {
        font-size: 12px;
        font-weight: 900;
      }

      .risk.high {
        background: rgba(239,68,68,0.13);
        border: 1px solid rgba(239,68,68,0.35);
        color: #fca5a5;
      }

      .risk.medium {
        background: rgba(234,179,8,0.13);
        border: 1px solid rgba(234,179,8,0.35);
        color: #fde68a;
      }

      .risk.low {
        background: rgba(34,197,94,0.13);
        border: 1px solid rgba(34,197,94,0.35);
        color: #86efac;
      }

      .reasonBox {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 14px;
      }

      .reasonBox span {
        padding: 8px 11px;
        border-radius: 999px;
        background: rgba(239,68,68,0.1);
        border: 1px solid rgba(239,68,68,0.3);
        color: #fecaca;
        font-size: 13px;
        font-weight: 900;
      }

      .infoGrid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
        margin-bottom: 14px;
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
        color: white;
        overflow-wrap: anywhere;
      }

      .actions {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 10px;
      }

      .dangerButton {
        background: linear-gradient(135deg, #ef4444, #991b1b);
        border: none;
      }

      .restoreButton {
        background: linear-gradient(135deg, #22c55e, #16a34a);
        border: none;
      }

      .caseList {
        display: grid;
        gap: 12px;
      }

      .caseCard {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 14px;
        padding: 16px;
        border-radius: 20px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.09);
      }

      .caseCard p {
        color: #a1a1aa;
        margin: 5px 0 0;
      }

      .caseCard span {
        color: #ef4444;
        font-weight: 900;
        text-transform: capitalize;
      }

      .empty {
        min-height: 220px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }
      
      .emptyIcon {
        width: 82px;
        height: 82px;
        border-radius: 50%;
        background: rgba(239,68,68,0.12);
        border: 1px solid rgba(239,68,68,0.35);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 38px;
        margin-bottom: 16px;
      }

      @media (max-width: 1000px) {
        .hero,
        .riskTop,
        .caseCard {
          grid-template-columns: 1fr;
          flex-direction: column;
          align-items: flex-start;
        }

        .stats,
        .filterGrid,
        .infoGrid,
        .actions {
          grid-template-columns: 1fr;
        }

        h1 {
          font-size: 44px;
        }

        .risk {
          text-align: left;
        }
      }

      @media (max-width: 600px) {
        .page {
          padding: 16px;
          padding-bottom: 120px;
        }

        .hero,
        .controls,
        .panel,
        .riskCard {
          padding: 22px;
          border-radius: 26px;
        }
      }
    `}</style>
  );
  }
