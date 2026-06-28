"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

type UserProfile = {
  id: string;
  email?: string;
  name?: string;
  role?: string;
  admin?: boolean;
  verified?: boolean;
  online?: boolean;
  createdAt?: any;
};

type Ride = {
  id: string;
  driverId?: string;
  driverEmail?: string;
  from?: string;
  to?: string;
  status?: string;
  price?: number;
  seats?: number;
  createdAt?: any;
};

type Booking = {
  id: string;
  rideId?: string;
  passengerEmail?: string;
  driverEmail?: string;
  status?: string;
  price?: number;
  seatsBooked?: number;
  createdAt?: any;
};

type Payout = {
  id: string;
  userId?: string;
  email?: string;
  amount?: number;
  status?: "pending" | "approved" | "rejected" | "paid";
  createdAt?: any;
};

type Rating = {
  id: string;
  driverEmail?: string;
  passengerEmail?: string;
  stars?: number;
  rating?: number;
  createdAt?: any;
};

type Tab = "overview" | "users" | "rides" | "bookings" | "payouts" | "reviews";

export default function AdminConsolePage() {
  const router = useRouter();

  const [currentUserId, setCurrentUserId] = useState("");
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);

  const [tab, setTab] = useState<Tab>("overview");
  const [status, setStatus] = useState("Loading admin console...");
  const [savingId, setSavingId] = useState("");

  useEffect(() => {
    let unsubscribeMe: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      setCurrentUserId(user.uid);

      unsubscribeMe = onSnapshot(
        doc(db, "users", user.uid),
        (snapshot) => {
          const data = snapshot.exists()
            ? ({ id: snapshot.id, ...snapshot.data() } as UserProfile)
            : null;

          setCurrentUser(data);

          const isAdmin =
            data?.admin === true ||
            data?.role === "admin" ||
            user.email === "jesusfernandez515@gmail.com";

          if (!isAdmin) {
            setStatus("Access denied. Admin account required.");
            return;
          }

          setStatus("");
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
    if (!currentUserId || !adminAllowed) return;

    const unsubscribeUsers = onSnapshot(
      query(collection(db, "users")),
      (snapshot) => {
        setUsers(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          })) as UserProfile[]
        );
      },
      (error) => setStatus(error.message)
    );

    const unsubscribeRides = onSnapshot(
      query(collection(db, "rides"), orderBy("createdAt", "desc")),
      (snapshot) => {
        setRides(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          })) as Ride[]
        );
      },
      (error) => setStatus(error.message)
    );

    const unsubscribeBookings = onSnapshot(
      query(collection(db, "bookings")),
      (snapshot) => {
        setBookings(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          })) as Booking[]
        );
      },
      (error) => setStatus(error.message)
    );

    const unsubscribePayouts = onSnapshot(
      query(collection(db, "payoutRequests"), orderBy("createdAt", "desc")),
      (snapshot) => {
        setPayouts(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          })) as Payout[]
        );
      },
      (error) => setStatus(error.message)
    );

    const unsubscribeRatings = onSnapshot(
      query(collection(db, "ratings")),
      (snapshot) => {
        setRatings(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          })) as Rating[]
        );
      },
      (error) => setStatus(error.message)
    );

    return () => {
      unsubscribeUsers();
      unsubscribeRides();
      unsubscribeBookings();
      unsubscribePayouts();
      unsubscribeRatings();
    };
  }, [currentUserId, adminAllowed]);

  function money(value: number) {
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
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Recently";
    }
  }

  const stats = useMemo(() => {
    const completedBookings = bookings.filter((item) => item.status === "completed");
    const grossRevenue = completedBookings.reduce(
      (total, item) =>
        total + Number(item.price || 0) * Number(item.seatsBooked || 1),
      0
    );

    const platformFee = Math.round(grossRevenue * 0.12);
    const pendingPayouts = payouts
      .filter((item) => item.status === "pending")
      .reduce((total, item) => total + Number(item.amount || 0), 0);

    return {
      users: users.length,
      online: users.filter((item) => item.online).length,
      rides: rides.length,
      activeRides: rides.filter((item) => item.status === "active").length,
      bookings: bookings.length,
      completedBookings: completedBookings.length,
      grossRevenue,
      platformFee,
      pendingPayouts,
      reviews: ratings.length,
    };
  }, [users, rides, bookings, payouts, ratings]);

  async function updateRideStatus(ride: Ride, status: string) {
    try {
      setSavingId(`ride-${ride.id}`);
      await updateDoc(doc(db, "rides", ride.id), {
        status,
        updatedAt: new Date().toISOString(),
      });
      setStatus(`Ride marked as ${status}.`);
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "Could not update ride.");
    } finally {
      setSavingId("");
    }
  }

  async function updateBookingStatus(booking: Booking, status: string) {
    try {
      setSavingId(`booking-${booking.id}`);
      await updateDoc(doc(db, "bookings", booking.id), {
        status,
        updatedAt: new Date().toISOString(),
      });
      setStatus(`Booking marked as ${status}.`);
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "Could not update booking.");
    } finally {
      setSavingId("");
    }
  }

  async function updatePayoutStatus(payout: Payout, status: Payout["status"]) {
    try {
      setSavingId(`payout-${payout.id}`);
      await updateDoc(doc(db, "payoutRequests", payout.id), {
        status,
        updatedAt: new Date().toISOString(),
        paidAt: status === "paid" ? new Date().toISOString() : "",
      });
      setStatus(`Payout marked as ${status}.`);
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "Could not update payout.");
    } finally {
      setSavingId("");
    }
  }

  async function toggleUserVerified(user: UserProfile) {
    try {
      setSavingId(`user-${user.id}`);
      await updateDoc(doc(db, "users", user.id), {
        verified: !user.verified,
        updatedAt: new Date().toISOString(),
      });
      setStatus("User verification updated.");
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "Could not update user.");
    } finally {
      setSavingId("");
    }
  }

  if (!adminAllowed) {
    return (
      <main className="page">
        <section className="locked">
          <h1>Admin <span>Console</span></h1>
          <p>{status || "Checking admin access..."}</p>
          <Link href="/dashboard" className="mainButton">Back to Dashboard</Link>
        </section>

        <PageStyles />
      </main>
    );
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topBar">
          <Link href="/dashboard" className="navButton">← Dashboard</Link>
          <Link href="/activity-feed" className="navButton">Activity Feed</Link>
          <Link href="/community" className="navButton">Community</Link>
          <Link href="/wallet" className="navButton">Wallet</Link>
          <Link href="/profile" className="navButton">Profile</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Enterprise</p>
            <h1>Admin <span>Console</span></h1>
            <p className="subtitle">
              Manage users, rides, bookings, payouts, reviews and platform activity in real time.
            </p>
          </div>

          <div className="liveOrb">
            <strong>LIVE</strong>
            <span>{stats.users} users</span>
          </div>
        </section>

        {status && <p className="status">{status}</p>}

        <section className="stats">
          <Metric icon="👥" label="Users" value={String(stats.users)} />
          <Metric icon="🟢" label="Online" value={String(stats.online)} />
          <Metric icon="🚗" label="Rides" value={String(stats.rides)} />
          <Metric icon="🎟️" label="Bookings" value={String(stats.bookings)} />
          <Metric icon="✅" label="Completed" value={String(stats.completedBookings)} />
          <Metric icon="💵" label="Gross" value={money(stats.grossRevenue)} />
          <Metric icon="🧾" label="Platform Fee" value={money(stats.platformFee)} />
          <Metric icon="🏦" label="Pending Payouts" value={money(stats.pendingPayouts)} />
        </section>

        <section className="tabs">
          <TabButton tab="overview" label="Overview" active={tab} setTab={setTab} />
          <TabButton tab="users" label="Users" active={tab} setTab={setTab} />
          <TabButton tab="rides" label="Rides" active={tab} setTab={setTab} />
          <TabButton tab="bookings" label="Bookings" active={tab} setTab={setTab} />
          <TabButton tab="payouts" label="Payouts" active={tab} setTab={setTab} />
          <TabButton tab="reviews" label="Reviews" active={tab} setTab={setTab} />
        </section>

        {tab === "overview" && (
          <section className="panel">
            <p className="eyebrow">Command Center</p>
            <h2>Platform Overview</h2>

            <div className="overviewGrid">
              <OverviewCard title="Active Rides" value={String(stats.activeRides)} text="Rides currently available." />
              <OverviewCard title="Reviews" value={String(stats.reviews)} text="Total driver ratings." />
              <OverviewCard title="Revenue" value={money(stats.grossRevenue)} text="Completed booking volume." />
              <OverviewCard title="RoadLink Fee" value={money(stats.platformFee)} text="Estimated platform fee." />
            </div>
          </section>
        )}

        {tab === "users" && (
          <section className="panel">
            <p className="eyebrow">Users</p>
            <h2>User Management</h2>

            <div className="list">
              {users.map((user) => (
                <article key={user.id} className="rowCard">
                  <div>
                    <strong>{user.name || user.email || "RoadLink User"}</strong>
                    <p>{user.email || user.id}</p>
                    <small>{user.online ? "🟢 Online" : "⚫ Offline"} · {user.verified ? "Verified" : "Not verified"}</small>
                  </div>

                  <button
                    onClick={() => toggleUserVerified(user)}
                    disabled={savingId === `user-${user.id}`}
                  >
                    {user.verified ? "Unverify" : "Verify"}
                  </button>
                </article>
              ))}
            </div>
          </section>
        )}

        {tab === "rides" && (
          <section className="panel">
            <p className="eyebrow">Rides</p>
            <h2>Ride Operations</h2>

            <div className="list">
              {rides.map((ride) => (
                <article key={ride.id} className="rowCard">
                  <div>
                    <strong>{ride.from || "Origin"} → {ride.to || "Destination"}</strong>
                    <p>{ride.driverEmail || "Driver"} · {money(Number(ride.price || 0))}</p>
                    <small>Status: {ride.status || "active"} · {formatDate(ride.createdAt)}</small>
                  </div>

                  <div className="actions">
                    <button onClick={() => updateRideStatus(ride, "active")}>Active</button>
                    <button onClick={() => updateRideStatus(ride, "completed")}>Complete</button>
                    <button onClick={() => updateRideStatus(ride, "cancelled")}>Cancel</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {tab === "bookings" && (
          <section className="panel">
            <p className="eyebrow">Bookings</p>
            <h2>Booking Control</h2>

            <div className="list">
              {bookings.map((booking) => (
                <article key={booking.id} className="rowCard">
                  <div>
                    <strong>{booking.passengerEmail || "Passenger"}</strong>
                    <p>Driver: {booking.driverEmail || "Driver"}</p>
                    <small>Status: {booking.status || "reserved"} · {formatDate(booking.createdAt)}</small>
                  </div>

                  <div className="actions">
                    <button onClick={() => updateBookingStatus(booking, "confirmed")}>Confirm</button>
                    <button onClick={() => updateBookingStatus(booking, "completed")}>Complete</button>
                    <button onClick={() => updateBookingStatus(booking, "cancelled")}>Cancel</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {tab === "payouts" && (
          <section className="panel">
            <p className="eyebrow">Wallet</p>
            <h2>Payout Requests</h2>

            <div className="list">
              {payouts.map((payout) => (
                <article key={payout.id} className="rowCard">
                  <div>
                    <strong>{payout.email || payout.userId || "Driver"}</strong>
                    <p>{money(Number(payout.amount || 0))}</p>
                    <small>Status: {payout.status || "pending"} · {formatDate(payout.createdAt)}</small>
                  </div>

                  <div className="actions">
                    <button onClick={() => updatePayoutStatus(payout, "approved")}>Approve</button>
                    <button onClick={() => updatePayoutStatus(payout, "paid")}>Paid</button>
                    <button onClick={() => updatePayoutStatus(payout, "rejected")}>Reject</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {tab === "reviews" && (
          <section className="panel">
            <p className="eyebrow">Reputation</p>
            <h2>Review Center</h2>

            <div className="list">
              {ratings.map((rating) => (
                <article key={rating.id} className="rowCard">
                  <div>
                    <strong>{Number(rating.stars || rating.rating || 0)}/5 Stars</strong>
                    <p>{rating.passengerEmail || "Passenger"} → {rating.driverEmail || "Driver"}</p>
                    <small>{formatDate(rating.createdAt)}</small>
                  </div>

                  <Link href="/reviews" className="linkButton">Open Reviews</Link>
                </article>
              ))}
            </div>
          </section>
        )}
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

function TabButton({
  tab,
  label,
  active,
  setTab,
}: {
  tab: Tab;
  label: string;
  active: Tab;
  setTab: (tab: Tab) => void;
}) {
  return (
    <button
      className={active === tab ? "tab activeTab" : "tab"}
      onClick={() => setTab(tab)}
    >
      {label}
    </button>
  );
}

function OverviewCard({ title, value, text }: { title: string; value: string; text: string }) {
  return (
    <div className="overviewCard">
      <span>{title}</span>
      <strong>{value}</strong>
      <p>{text}</p>
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
          radial-gradient(circle at top right, rgba(34,197,94,0.25), transparent 35%),
          radial-gradient(circle at bottom left, rgba(16,185,129,0.13), transparent 35%),
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

      .navButton,
      .linkButton,
      .mainButton {
        color: white;
        text-decoration: none;
        font-weight: 900;
        padding: 12px 18px;
        border-radius: 999px;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.1);
        text-align: center;
      }

      .hero,
      .metric,
      .tabs,
      .panel,
      .locked,
      .overviewCard,
      .rowCard {
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
      .liveOrb strong,
      .overviewCard strong {
        color: #22c55e;
      }

      .subtitle,
      .locked p {
        color: #a1a1aa;
        max-width: 680px;
        line-height: 1.5;
        font-size: 18px;
        margin: 0;
      }

      .liveOrb {
        min-width: 120px;
        height: 120px;
        border-radius: 50%;
        background: rgba(34,197,94,0.13);
        border: 1px solid rgba(34,197,94,0.35);
        display: flex;
        justify-content: center;
        align-items: center;
        flex-direction: column;
      }

      .liveOrb span {
        color: #d4d4d8;
        font-size: 12px;
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
        font-size: 24px;
        overflow-wrap: anywhere;
      }

      .tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        border-radius: 26px;
        padding: 14px;
        margin-bottom: 20px;
      }

      .tab {
        padding: 12px 16px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.1);
        background: rgba(255,255,255,0.04);
        color: white;
        font-weight: 900;
        cursor: pointer;
      }

      .activeTab {
        color: #22c55e;
        background: rgba(34,197,94,0.12);
        border-color: rgba(34,197,94,0.4);
      }

      .panel {
        border-radius: 30px;
        padding: 30px;
      }

      .overviewGrid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 14px;
      }

      .overviewCard {
        border-radius: 22px;
        padding: 20px;
        box-shadow: none;
      }

      .overviewCard span {
        color: #a1a1aa;
        font-weight: 900;
      }

      .overviewCard strong {
        display: block;
        font-size: 30px;
        margin: 10px 0;
      }

      .overviewCard p {
        color: #a1a1aa;
        line-height: 1.4;
        margin: 0;
      }

      .list {
        display: grid;
        gap: 12px;
      }

      .rowCard {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 16px;
        align-items: center;
        border-radius: 22px;
        padding: 18px;
        box-shadow: none;
      }

      .rowCard strong {
        display: block;
        font-size: 17px;
        margin-bottom: 5px;
        overflow-wrap: anywhere;
      }

      .rowCard p,
      .rowCard small {
        color: #a1a1aa;
        margin: 0;
        overflow-wrap: anywhere;
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      button {
        border: none;
        border-radius: 999px;
        padding: 11px 14px;
        background: rgba(34,197,94,0.12);
        border: 1px solid rgba(34,197,94,0.35);
        color: #22c55e;
        font-weight: 900;
        cursor: pointer;
      }

      button:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      @media (max-width: 980px) {
        .stats,
        .overviewGrid {
          grid-template-columns: repeat(2, 1fr);
        }
      }

      @media (max-width: 760px) {
        .page {
          padding: 16px;
          padding-bottom: 120px;
        }

        .hero {
          flex-direction: column;
          align-items: flex-start;
          padding: 26px;
        }

        h1 {
          font-size: 44px;
        }

        .stats,
        .overviewGrid {
          grid-template-columns: 1fr;
        }

        .panel {
          padding: 22px;
          border-radius: 26px;
        }

        .rowCard {
          grid-template-columns: 1fr;
        }

        .actions {
          display: grid;
        }

        .actions button {
          width: 100%;
        }
      }
    `}</style>
  );
        }
