"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type AccountStatus =
  | "active"
  | "trial"
  | "pending"
  | "suspended";

type CorporateAccount = {
  id: string;
  companyName?: string;
  contactName?: string;
  contactEmail?: string;
  city?: string;
  state?: string;
  employees?: number;
  activeUsers?: number;
  monthlyBookings?: number;
  monthlyRevenue?: number;
  status?: AccountStatus;
  createdAt?: string;
};

export default function AdminCorporateAccountsPage() {
  const [accounts, setAccounts] = useState<CorporateAccount[]>([]);
  const [message, setMessage] = useState("Loading corporate accounts...");
  const [saving, setSaving] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [city, setCity] = useState("");
  const [stateValue, setStateValue] = useState("");

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "corporateAccounts")),
      (snapshot) => {
        setAccounts(
          snapshot.docs.map((docItem) => ({
            id: docItem.id,
            ...docItem.data(),
          })) as CorporateAccount[]
        );

        setMessage("");
      },
      () => {
        setAccounts([]);
      }
    );

    return () => unsubscribe();
  }, []);

  const analytics = useMemo(() => {
    const activeAccounts = accounts.filter(
      (item) => item.status === "active"
    );

    const trialAccounts = accounts.filter(
      (item) => item.status === "trial"
    );

    const pendingAccounts = accounts.filter(
      (item) => item.status === "pending"
    );

    const totalEmployees = accounts.reduce(
      (sum, item) => sum + Number(item.employees || 0),
      0
    );

    const activeUsers = accounts.reduce(
      (sum, item) => sum + Number(item.activeUsers || 0),
      0
    );

    const bookings = accounts.reduce(
      (sum, item) => sum + Number(item.monthlyBookings || 0),
      0
    );

    const revenue = accounts.reduce(
      (sum, item) => sum + Number(item.monthlyRevenue || 0),
      0
    );

    return {
      activeAccounts,
      trialAccounts,
      pendingAccounts,
      totalEmployees,
      activeUsers,
      bookings,
      revenue,
    };
  }, [accounts]);

  async function createAccount() {
    if (!companyName.trim()) {
      setMessage("Company name required.");
      return;
    }

    try {
      setSaving(true);

      const now = new Date().toISOString();
      const id = `corp-${Date.now()}`;

      await setDoc(
        doc(db, "corporateAccounts", id),
        {
          companyName,
          contactName,
          contactEmail,
          city,
          state: stateValue,
          employees: 0,
          activeUsers: 0,
          monthlyBookings: 0,
          monthlyRevenue: 0,
          status: "trial",
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

      setCompanyName("");
      setContactName("");
      setContactEmail("");
      setCity("");
      setStateValue("");

      setMessage("Corporate account created.");
    } catch {
      setMessage("Could not create account.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(
    accountId: string,
    status: AccountStatus
  ) {
    try {
      await setDoc(
        doc(db, "corporateAccounts", accountId),
        {
          status,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch {
      setMessage("Could not update account.");
    }
  }

  function money(value: number) {
    return `$${Math.round(value).toLocaleString()}`;
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">
            Admin
          </Link>

          <Link
            href="/admin/partnerships"
            className="miniButton"
          >
            Partnerships
          </Link>

          <Link
            href="/admin/analytics"
            className="miniButton"
          >
            Analytics
          </Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">
              RoadLink Enterprise
            </p>

            <h1>
              Corporate <span>Accounts</span>
            </h1>

            <p className="subtitle">
              Manage universities, companies,
              hospitals, hotels and enterprise
              clients using RoadLink.
            </p>
          </div>

          <div className="orb">
            <strong>
              {money(analytics.revenue)}
            </strong>
            <span>Monthly Revenue</span>
          </div>
        </section>

        {message && (
          <p className="message">{message}</p>
        )}

        <section className="stats">
          <Metric
            icon="🏢"
            label="Accounts"
            value={String(accounts.length)}
          />

          <Metric
            icon="✅"
            label="Active"
            value={String(
              analytics.activeAccounts.length
            )}
          />

          <Metric
            icon="🧪"
            label="Trial"
            value={String(
              analytics.trialAccounts.length
            )}
          />

          <Metric
            icon="👥"
            label="Employees"
            value={analytics.totalEmployees.toLocaleString()}
          />

          <Metric
            icon="🚘"
            label="Bookings"
            value={analytics.bookings.toLocaleString()}
          />

          <Metric
            icon="💰"
            label="Revenue"
            value={money(analytics.revenue)}
          />
        </section>

        <section className="card">
          <p className="eyebrow">
            Create Corporate Account
          </p>

          <div className="formGrid">
            <input
              placeholder="Company Name"
              value={companyName}
              onChange={(e) =>
                setCompanyName(e.target.value)
              }
            />

            <input
              placeholder="Contact Name"
              value={contactName}
              onChange={(e) =>
                setContactName(e.target.value)
              }
            />

            <input
              placeholder="Contact Email"
              value={contactEmail}
              onChange={(e) =>
                setContactEmail(e.target.value)
              }
            />

            <input
              placeholder="City"
              value={city}
              onChange={(e) =>
                setCity(e.target.value)
              }
            />

            <input
              placeholder="State"
              value={stateValue}
              onChange={(e) =>
                setStateValue(e.target.value)
              }
            />
          </div>

          <button
            className="saveButton"
            onClick={createAccount}
            disabled={saving}
          >
            Create Account
          </button>
        </section>

        <section className="card">
          <p className="eyebrow">
            Enterprise Clients
          </p>

          <div className="accountGrid">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="accountCard"
              >
                <h3>
                  {account.companyName ||
                    "Unknown"}
                </h3>

                <p>
                  {account.contactEmail ||
                    "No email"}
                </p>

                <div className="info">
                  <span>
                    Employees:{" "}
                    {account.employees || 0}
                  </span>

                  <span>
                    Active Users:{" "}
                    {account.activeUsers || 0}
                  </span>

                  <span>
                    Monthly Bookings:{" "}
                    {account.monthlyBookings || 0}
                  </span>

                  <span>
                    Revenue:{" "}
                    {money(
                      Number(
                        account.monthlyRevenue || 0
                      )
                    )}
                  </span>
                </div>

                <div className="actions">
                  <button
                    onClick={() =>
                      changeStatus(
                        account.id,
                        "active"
                      )
                    }
                  >
                    Activate
                  </button>

                  <button
                    onClick={() =>
                      changeStatus(
                        account.id,
                        "trial"
                      )
                    }
                  >
                    Trial
                  </button>

                  <button
                    onClick={() =>
                      changeStatus(
                        account.id,
                        "suspended"
                      )
                    }
                  >
                    Suspend
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>

      <style>{`
      *{box-sizing:border-box}

      .page{
        min-height:100vh;
        padding:24px;
        color:white;
        font-family:Arial,sans-serif;
        background:
        radial-gradient(circle at top right,rgba(34,197,94,.18),transparent 30%),
        linear-gradient(135deg,#020617,#030712,#0f172a);
      }

      .container{
        max-width:1400px;
        margin:auto;
      }

      .topNav{
        display:flex;
        flex-wrap:wrap;
        gap:12px;
        margin-bottom:20px;
      }

      .miniButton{
        padding:10px 18px;
        border-radius:999px;
        text-decoration:none;
        color:white;
        border:1px solid rgba(255,255,255,.12);
      }

      .hero,.card,.metric{
        background:rgba(8,13,25,.92);
        border:1px solid rgba(255,255,255,.12);
        border-radius:28px;
      }

      .hero{
        padding:30px;
        display:flex;
        justify-content:space-between;
        margin-bottom:20px;
      }

      .orb{
        width:120px;
        height:120px;
        border-radius:50%;
        background:rgba(34,197,94,.12);
        display:flex;
        flex-direction:column;
        justify-content:center;
        align-items:center;
      }

      .eyebrow{
        color:#22c55e;
        font-weight:900;
      }

      h1{
        font-size:54px;
        margin:10px 0;
      }

      h1 span{
        color:#22c55e;
      }

      .stats{
        display:grid;
        grid-template-columns:repeat(6,1fr);
        gap:12px;
        margin-bottom:20px;
      }

      .metric{
        padding:18px;
      }

      .card{
        padding:24px;
        margin-bottom:20px;
      }

      .formGrid{
        display:grid;
        gap:12px;
      }

      input{
        padding:15px;
        border-radius:14px;
        border:none;
        background:rgba(255,255,255,.08);
        color:white;
      }

      .saveButton{
        margin-top:15px;
        width:100%;
        padding:16px;
        border:none;
        border-radius:999px;
        font-weight:900;
        background:#22c55e;
        color:white;
      }

      .accountGrid{
        display:grid;
        gap:15px;
      }

      .accountCard{
        padding:18px;
        border-radius:18px;
        background:rgba(255,255,255,.04);
      }

      .info{
        display:grid;
        gap:6px;
        margin-top:12px;
      }

      .actions{
        display:flex;
        gap:10px;
        margin-top:15px;
        flex-wrap:wrap;
      }

      .actions button{
        padding:10px 14px;
        border:none;
        border-radius:999px;
        cursor:pointer;
      }

      @media(max-width:900px){
        .stats{
          grid-template-columns:repeat(2,1fr);
        }

        h1{
          font-size:42px;
        }

        .hero{
          flex-direction:column;
          gap:20px;
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
      <div style={{ fontSize: 28 }}>{icon}</div>
      <div style={{ color: "#9ca3af" }}>
        {label}
      </div>
      <strong
        style={{
          color: "#22c55e",
          fontSize: 22,
        }}
      >
        {value}
      </strong>
    </div>
  );
}
