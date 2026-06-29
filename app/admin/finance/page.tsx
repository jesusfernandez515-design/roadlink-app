"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, onSnapshot, query } from "firebase/firestore";
import { auth, db } from "../../../lib/firebase";

type UserProfile = {
  id: string;
  email?: string;
  role?: string;
  admin?: boolean;
};

type Booking = {
  id: string;
  driverId?: string;
  passengerId?: string;
  driverEmail?: string;
  passengerEmail?: string;
  status?: string;
  price?: number;
  seatsBooked?: number;
  createdAt?: any;
};

type Payout = {
  id: string;
  driverId?: string;
  driverEmail?: string;
  amount?: number;
  status?: string;
  createdAt?: any;
};

type Refund = {
  id: string;
  userEmail?: string;
  amount?: number;
  status?: string;
  createdAt?: any;
};

type Transaction = {
  id: string;
  type: string;
  email: string;
  amount: number;
  status: string;
  createdAt?: any;
};

export default function AdminFinancePage() {
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("Loading finance center...");

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

    const unsubBookings = onSnapshot(query(collection(db, "bookings")), (snapshot) => {
      setBookings(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as Booking[]);
      setMessage("");
    });

    const unsubPayouts = onSnapshot(query(collection(db, "payoutRequests")), (snapshot) => {
      setPayouts(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as Payout[]);
    });

    const unsubRefunds = onSnapshot(query(collection(db, "refundRequests")), (snapshot) => {
      setRefunds(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as Refund[]);
    });

    return () => {
      unsubBookings();
      unsubPayouts();
      unsubRefunds();
    };
  }, [adminAllowed]);

  function clean(value?: string) {
    return String(value || "").toLowerCase();
  }

  function money(value?: number) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  function getDate(value?: any) {
    if (!value) return new Date(0);
    const date = value?.toDate ? value.toDate() : new Date(value);
    return Number.isNaN(date.getTime()) ? new Date(0) : date;
  }

  function isToday(value?: any) {
    const date = getDate(value);
    const now = new Date();
    return date.toDateString() === now.toDateString();
  }

  function isThisWeek(value?: any) {
    const date = getDate(value);
    const now = new Date();
    const start = new Date();
    start.setDate(now.getDate() - 7);
    return date >= start && date <= now;
  }

  function isThisMonth(value?: any) {
    const date = getDate(value);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }

  function formatDate(value?: any) {
    const date = getDate(value);
    if (date.getTime() === 0) return "Not available";
    return date.toLocaleString();
  }

  const finance = useMemo(() => {
    const completed = bookings.filter((item) => clean(item.status) === "completed");

    const grossRevenue = completed.reduce(
      (total, item) => total + Number(item.price || 0) * Number(item.seatsBooked || 1),
      0
    );

    const todayRevenue = completed
      .filter((item) => isToday(item.createdAt))
      .reduce((total, item) => total + Number(item.price || 0) * Number(item.seatsBooked || 1), 0);

    const weekRevenue = completed
      .filter((item) => isThisWeek(item.createdAt))
      .reduce((total, item) => total + Number(item.price || 0) * Number(item.seatsBooked || 1), 0);

    const monthRevenue = completed
      .filter((item) => isThisMonth(item.createdAt))
      .reduce((total, item) => total + Number(item.price || 0) * Number(item.seatsBooked || 1), 0);

    const platformFee = grossRevenue * 0.12;
    const driverShare = grossRevenue * 0.88;

    const paidPayouts = payouts
      .filter((item) => clean(item.status) === "paid")
      .reduce((total, item) => total + Number(item.amount || 0), 0);

    const pendingPayouts = payouts
      .filter((item) => ["pending", "approved"].includes(clean(item.status)))
      .reduce((total, item) => total + Number(item.amount || 0), 0);

    const paidRefunds = refunds
      .filter((item) => ["paid", "approved"].includes(clean(item.status)))
      .reduce((total, item) => total + Number(item.amount || 0), 0);

    const netRevenue = platformFee - paidRefunds;

    const transactions: Transaction[] = [
      ...completed.map((item) => ({
        id: item.id,
        type: "Booking",
        email: item.passengerEmail || "Passenger",
        amount: Number(item.price || 0) * Number(item.seatsBooked || 1),
        status: item.status || "completed",
        createdAt: item.createdAt,
      })),
      ...payouts.map((item) => ({
        id: item.id,
        type: "Payout",
        email: item.driverEmail || "Driver",
        amount: Number(item.amount || 0),
        status: item.status || "pending",
        createdAt: item.createdAt,
      })),
      ...refunds.map((item) => ({
        id: item.id,
        type: "Refund",
        email: item.userEmail || "User",
        amount: Number(item.amount || 0),
        status: item.status || "pending",
        createdAt: item.createdAt,
      })),
    ].sort((a, b) => getDate(b.createdAt).getTime() - getDate(a.createdAt).getTime());

    return {
      completedTrips: completed.length,
      grossRevenue,
      todayRevenue,
      weekRevenue,
      monthRevenue,
      platformFee,
      driverShare,
      paidPayouts,
      pendingPayouts,
      paidRefunds,
      netRevenue,
      transactions,
      averageTicket: completed.length ? grossRevenue / completed.length : 0,
    };
  }, [bookings, payouts, refunds]);

  const filteredTransactions = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) return finance.transactions;

    return finance.transactions.filter(
      (item) =>
        item.id.toLowerCase().includes(value) ||
        item.type.toLowerCase().includes(value) ||
        item.email.toLowerCase().includes(value) ||
        item.status.toLowerCase().includes(value)
    );
  }, [finance.transactions, search]);

  if (!adminAllowed) {
    return (
      <main className="page">
        <section className="locked">
          <h1>Finance <span>Center</span></h1>
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
          <Link href="/admin/refunds" className="navButton">Refunds</Link>
          <Link href="/admin/analytics" className="navButton">Analytics</Link>
          <Link href="/admin/platform-settings" className="navButton">Settings</Link>
          <Link href="/wallet" className="navButton">Wallet</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Financial Operations</p>
            <h1>Finance <span>Center</span></h1>
            <p className="subtitle">
              Monitor revenue, platform commissions, driver payouts, refunds, net balance and transaction history.
            </p>
          </div>

          <div className={finance.netRevenue >= 0 ? "moneyOrb" : "moneyOrb dangerOrb"}>
            <strong>{money(finance.netRevenue)}</strong>
            <span>Net Revenue</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="💰" label="Gross Revenue" value={money(finance.grossRevenue)} />
          <Metric icon="📅" label="Today" value={money(finance.todayRevenue)} />
          <Metric icon="📆" label="This Week" value={money(finance.weekRevenue)} />
          <Metric icon="🗓️" label="This Month" value={money(finance.monthRevenue)} />
          <Metric icon="🧾" label="RoadLink Fee" value={money(finance.platformFee)} />
          <Metric icon="🚗" label="Driver Share" value={money(finance.driverShare)} />
          <Metric icon="🏦" label="Paid Payouts" value={money(finance.paidPayouts)} />
          <Metric icon="⏳" label="Pending Payouts" value={money(finance.pendingPayouts)} />
          <Metric icon="🔄" label="Refunds" value={money(finance.paidRefunds)} />
          <Metric icon="📈" label="Net Revenue" value={money(finance.netRevenue)} />
          <Metric icon="🎟️" label="Completed Trips" value={String(finance.completedTrips)} />
          <Metric icon="💵" label="Avg Ticket" value={money(finance.averageTicket)} />
        </section>

        <section className="grid">
          <section className="panel">
            <p className="eyebrow">Revenue</p>
            <h2>Revenue Breakdown</h2>

            <Bar label="Today Revenue" value={finance.todayRevenue} max={Math.max(finance.monthRevenue, 1)} />
            <Bar label="Week Revenue" value={finance.weekRevenue} max={Math.max(finance.monthRevenue, 1)} />
            <Bar label="Month Revenue" value={finance.monthRevenue} max={Math.max(finance.monthRevenue, 1)} />
            <Bar label="Platform Fee" value={finance.platformFee} max={Math.max(finance.grossRevenue, 1)} />
          </section>

          <section className="panel">
            <p className="eyebrow">Balance</p>
            <h2>Financial Health</h2>

            <Info label="Gross Revenue" value={money(finance.grossRevenue)} />
            <Info label="RoadLink Commission" value={money(finance.platformFee)} />
            <Info label="Refund Exposure" value={money(finance.paidRefunds)} />
            <Info label="Net Revenue" value={money(finance.netRevenue)} />
            <Info label="Pending Payout Liability" value={money(finance.pendingPayouts)} />
            <Info label="Transactions" value={String(finance.transactions.length)} />
          </section>
        </section>

        <section className="panel">
          <div className="sectionTop">
            <div>
              <p className="eyebrow">Transactions</p>
              <h2>Recent Financial Activity</h2>
            </div>

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by email, ID, type or status..."
            />
          </div>

          {filteredTransactions.length === 0 ? (
            <div className="empty">
              <h3>No transactions found</h3>
              <p>Bookings, payouts and refunds will appear here.</p>
            </div>
          ) : (
            <div className="transactionList">
              {filteredTransactions.slice(0, 80).map((item) => (
                <article key={`${item.type}-${item.id}`} className="transaction">
                  <div className="transactionIcon">
                    {item.type === "Booking" ? "🎟️" : item.type === "Payout" ? "🏦" : "🔄"}
                  </div>

                  <div>
                    <h3>{item.type}</h3>
                    <p>{item.email}</p>
                    <small>{item.id}</small>
                  </div>

                  <div className="transactionRight">
                    <strong>{money(item.amount)}</strong>
                    <span>{item.status}</span>
                    <small>{formatDate(item.createdAt)}</small>
                  </div>
                </article>
              ))}
            </div>
          )}
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

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  const width = Math.max(4, Math.min(100, Math.round((value / max) * 100)));

  return (
    <div className="barRow">
      <div className="barTop">
        <span>{label}</span>
        <strong>${Number(value || 0).toFixed(2)}</strong>
      </div>

      <div className="bar">
        <div style={{ width: `${width}%` }} />
      </div>
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
        max-width: 1240px;
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
      .transaction,
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
      .moneyOrb strong {
        color: #22c55e;
      }

      .subtitle,
      .empty p,
      .locked p {
        color: #a1a1aa;
        max-width: 780px;
        line-height: 1.5;
        font-size: 18px;
        margin: 0;
      }

      .moneyOrb {
        min-width: 140px;
        height: 140px;
        border-radius: 50%;
        background: rgba(34,197,94,0.13);
        border: 1px solid rgba(34,197,94,0.35);
        display: flex;
        justify-content: center;
        align-items: center;
        flex-direction: column;
        text-align: center;
        padding: 14px;
      }

      .dangerOrb {
        background: rgba(239,68,68,0.13);
        border-color: rgba(239,68,68,0.35);
      }

      .dangerOrb strong {
        color: #fca5a5;
      }

      .moneyOrb strong {
        font-size: 22px;
      }

      .moneyOrb span {
        color: #d4d4d8;
        font-weight: 900;
        font-size: 12px;
      }

      .message {
        color: #22c55e;
        text-align: center;
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

      .info {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 12px;
        padding: 14px;
        border-radius: 16px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.09);
        margin-bottom: 10px;
      }

      .info span,
      .barTop span,
      .transaction p,
      .transaction small {
        color: #a1a1aa;
        font-weight: 900;
      }

      .info strong,
      .barTop strong {
        color: #e5e7eb;
      }

      .barRow {
        margin-bottom: 18px;
      }

      .barTop {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 8px;
      }

      .bar {
        height: 13px;
        background: rgba(255,255,255,0.08);
        border-radius: 999px;
        overflow: hidden;
      }

      .bar div {
        height: 100%;
        border-radius: 999px;
        background: linear-gradient(135deg, #22c55e, #16a34a);
      }

      .sectionTop {
        display: grid;
        grid-template-columns: 1fr 380px;
        gap: 18px;
        align-items: center;
        margin-bottom: 20px;
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

      .transactionList {
        display: grid;
        gap: 12px;
      }

      .transaction {
        display: grid;
        grid-template-columns: auto 1fr auto;
        gap: 14px;
        align-items: center;
        padding: 16px;
        border-radius: 20px;
        box-shadow: none;
      }

      .transactionIcon {
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

      .transaction h3 {
        margin: 0 0 5px;
      }

      .transaction p,
      .transaction small {
        margin: 0;
        overflow-wrap: anywhere;
      }

      .transactionRight {
        text-align: right;
      }

      .transactionRight strong {
        display: block;
        color: #22c55e;
        margin-bottom: 5px;
      }

      .transactionRight span {
        display: inline-flex;
        padding: 6px 9px;
        border-radius: 999px;
        background: rgba(34,197,94,0.12);
        border: 1px solid rgba(34,197,94,0.35);
        color: #22c55e;
        font-size: 12px;
        font-weight: 900;
        text-transform: capitalize;
        margin-bottom: 5px;
      }

      .empty {
        min-height: 220px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }

      .empty h3 {
        margin: 0 0 8px;
      }

      @media (max-width: 1000px) {
        .hero,
        .grid,
        .sectionTop {
          grid-template-columns: 1fr;
          flex-direction: column;
          align-items: flex-start;
        }

        .stats {
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

        .transaction {
          grid-template-columns: 1fr;
        }

        .transactionRight {
          text-align: left;
        }
      }
    `}</style>
  );
      }
