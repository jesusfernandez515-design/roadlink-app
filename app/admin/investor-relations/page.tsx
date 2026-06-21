"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type InvestorUpdate = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
};

type KPI = {
  users: number;
  rides: number;
  bookings: number;
  revenue: number;
};

export default function AdminInvestorRelationsCenter() {
  const [users, setUsers] = useState<any[]>([]);
  const [rides, setRides] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [updates, setUpdates] = useState<InvestorUpdate[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const unsubRides = onSnapshot(collection(db, "rides"), (snap) => {
      setRides(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const unsubBookings = onSnapshot(collection(db, "bookings"), (snap) => {
      setBookings(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const unsubUpdates = onSnapshot(
      collection(db, "investorUpdates"),
      (snap) => {
        setUpdates(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as InvestorUpdate),
          }))
        );
      }
    );

    return () => {
      unsubUsers();
      unsubRides();
      unsubBookings();
      unsubUpdates();
    };
  }, []);

  const kpis: KPI = useMemo(() => {
    const revenue = bookings.reduce(
      (sum, booking: any) =>
        sum + Number(booking.amount || booking.price || 0),
      0
    );

    return {
      users: users.length,
      rides: rides.length,
      bookings: bookings.length,
      revenue,
    };
  }, [users, rides, bookings]);

  async function saveUpdate() {
    try {
      setSaving(true);

      const id = `update-${Date.now()}`;

      await setDoc(doc(db, "investorUpdates", id), {
        id,
        title,
        description,
        createdAt: new Date().toISOString(),
      });

      await setDoc(
        doc(db, "auditLogs", `investor-${Date.now()}`),
        {
          action: "Investor Update Created",
          title,
          createdAt: new Date().toISOString(),
        },
        { merge: true }
      );

      setTitle("");
      setDescription("");
      setMessage("Investor update published.");
    } catch {
      setMessage("Could not save update.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page">
      <section className="container">

        <div className="topNav">
          <Link href="/admin" className="navBtn">
            Admin
          </Link>

          <Link href="/admin/executive" className="navBtn">
            Executive
          </Link>

          <Link href="/admin/investor-board" className="navBtn">
            Investor Board
          </Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">
              ROADLINK INVESTOR RELATIONS
            </p>

            <h1>
              Investor <span>Relations</span>
            </h1>

            <p className="subtitle">
              Manage investor communications,
              traction reports, growth updates
              and funding readiness.
            </p>
          </div>
        </section>

        {message && (
          <div className="message">{message}</div>
        )}

        <section className="stats">
          <Stat
            label="Users"
            value={kpis.users.toLocaleString()}
          />

          <Stat
            label="Rides"
            value={kpis.rides.toLocaleString()}
          />

          <Stat
            label="Bookings"
            value={kpis.bookings.toLocaleString()}
          />

          <Stat
            label="Revenue"
            value={`$${Math.round(
              kpis.revenue
            ).toLocaleString()}`}
          />
        </section>

        <section className="panel">
          <h2>Create Investor Update</h2>

          <input
            placeholder="Update Title"
            value={title}
            onChange={(e) =>
              setTitle(e.target.value)
            }
          />

          <textarea
            placeholder="Update Description"
            value={description}
            onChange={(e) =>
              setDescription(e.target.value)
            }
          />

          <button
            onClick={saveUpdate}
            disabled={saving}
          >
            {saving
              ? "Publishing..."
              : "Publish Update"}
          </button>
        </section>

        <section className="panel">
          <h2>Investor Updates</h2>

          <div className="updates">
            {updates.length === 0 && (
              <div className="empty">
                No investor updates yet.
              </div>
            )}

            {updates.map((item) => (
              <div
                key={item.id}
                className="updateCard"
              >
                <h3>{item.title}</h3>

                <p>{item.description}</p>

                <span>
                  {new Date(
                    item.createdAt
                  ).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </section>
      </section>

      <style>{`
      *{
        box-sizing:border-box;
      }

      .page{
        min-height:100vh;
        padding:24px;
        color:white;
        background:
        linear-gradient(
        135deg,
        #020617,
        #030712,
        #0f172a
        );
      }

      .container{
        max-width:1400px;
        margin:auto;
      }

      .topNav{
        display:flex;
        gap:12px;
        flex-wrap:wrap;
        margin-bottom:20px;
      }

      .navBtn{
        color:white;
        text-decoration:none;
        padding:10px 16px;
        border-radius:999px;
        background:rgba(255,255,255,.05);
        border:1px solid rgba(255,255,255,.1);
      }

      .hero,
      .panel,
      .stat{
        background:rgba(8,13,25,.92);
        border:1px solid rgba(255,255,255,.1);
        border-radius:24px;
      }

      .hero{
        padding:32px;
        margin-bottom:20px;
      }

      .eyebrow{
        color:#22c55e;
        font-weight:900;
      }

      h1{
        font-size:52px;
        margin:10px 0;
      }

      h1 span{
        color:#22c55e;
      }

      .subtitle{
        color:#a1a1aa;
      }

      .stats{
        display:grid;
        grid-template-columns:repeat(4,1fr);
        gap:16px;
        margin-bottom:20px;
      }

      .stat{
        padding:20px;
      }

      .stat span{
        display:block;
        color:#a1a1aa;
      }

      .stat strong{
        color:#22c55e;
        font-size:28px;
      }

      .panel{
        padding:24px;
        margin-bottom:20px;
      }

      input,
      textarea{
        width:100%;
        margin-top:10px;
        margin-bottom:12px;
        padding:14px;
        border-radius:12px;
        border:none;
        background:#111827;
        color:white;
      }

      textarea{
        min-height:120px;
      }

      button{
        width:100%;
        padding:16px;
        border:none;
        border-radius:999px;
        background:#22c55e;
        color:white;
        font-weight:900;
        cursor:pointer;
      }

      .message{
        color:#22c55e;
        margin-bottom:16px;
        font-weight:900;
      }

      .updates{
        display:grid;
        gap:12px;
      }

      .updateCard{
        padding:18px;
        border-radius:16px;
        background:#111827;
      }

      .updateCard h3{
        margin:0 0 8px;
        color:#22c55e;
      }

      .updateCard p{
        color:#d4d4d8;
      }

      .updateCard span{
        color:#71717a;
        font-size:12px;
      }

      .empty{
        color:#71717a;
      }

      @media(max-width:900px){
        .stats{
          grid-template-columns:1fr 1fr;
        }

        h1{
          font-size:40px;
        }
      }

      @media(max-width:600px){
        .stats{
          grid-template-columns:1fr;
        }
      }
      `}</style>
    </main>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
