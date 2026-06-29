"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

type BusinessAccount = {
  id: string;
  ownerId?: string;
  ownerEmail?: string;
  companyName?: string;
  industry?: string;
  employees?: number;
  monthlyBudget?: number;
  status?: string;
  createdAt?: string;
};

type BusinessTrip = {
  id: string;
  businessId?: string;
  employeeName?: string;
  employeeEmail?: string;
  from?: string;
  to?: string;
  purpose?: string;
  department?: string;
  costCenter?: string;
  estimatedCost?: number;
  status?: string;
  createdAt?: string;
};

export default function BusinessPage() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [businesses, setBusinesses] = useState<BusinessAccount[]>([]);
  const [trips, setTrips] = useState<BusinessTrip[]>([]);
  const [status, setStatus] = useState("Loading business accounts...");
  const [saving, setSaving] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [employees, setEmployees] = useState("");
  const [monthlyBudget, setMonthlyBudget] = useState("");

  const [employeeName, setEmployeeName] = useState("");
  const [employeeEmail, setEmployeeEmail] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [purpose, setPurpose] = useState("");
  const [department, setDepartment] = useState("");
  const [costCenter, setCostCenter] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      setUserId(user.uid);
      setUserEmail(user.email || "");
      setStatus("");
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!userId) return;

    const unsubscribeBusinesses = onSnapshot(
      query(collection(db, "businessAccounts"), where("ownerId", "==", userId)),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as BusinessAccount[];

        data.sort((a, b) =>
          String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
        );

        setBusinesses(data);
      },
      (error) => setStatus(error.message)
    );

    return () => unsubscribeBusinesses();
  }, [userId]);

  const activeBusiness = businesses[0];

  useEffect(() => {
    if (!activeBusiness?.id) return;

    const unsubscribeTrips = onSnapshot(
      query(collection(db, "businessTrips"), where("businessId", "==", activeBusiness.id)),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as BusinessTrip[];

        data.sort((a, b) =>
          String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
        );

        setTrips(data);
      },
      (error) => setStatus(error.message)
    );

    return () => unsubscribeTrips();
  }, [activeBusiness?.id]);

  const stats = useMemo(() => {
    const totalSpend = trips.reduce(
      (total, item) => total + Number(item.estimatedCost || 0),
      0
    );

    const pendingTrips = trips.filter((item) => item.status === "pending").length;
    const approvedTrips = trips.filter((item) => item.status === "approved").length;
    const completedTrips = trips.filter((item) => item.status === "completed").length;

    return {
      totalSpend,
      pendingTrips,
      approvedTrips,
      completedTrips,
      totalTrips: trips.length,
      budgetLeft: Math.max(Number(activeBusiness?.monthlyBudget || 0) - totalSpend, 0),
    };
  }, [trips, activeBusiness?.monthlyBudget]);

  function money(value?: number) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  async function createBusinessAccount() {
    if (!userId) return;

    if (!companyName.trim()) {
      setStatus("Company name is required.");
      return;
    }

    try {
      setSaving(true);
      setStatus("");

      const now = new Date().toISOString();

      await addDoc(collection(db, "businessAccounts"), {
        ownerId: userId,
        ownerEmail: userEmail,
        companyName: companyName.trim(),
        industry: industry.trim(),
        employees: Number(employees || 0),
        monthlyBudget: Number(monthlyBudget || 0),
        status: "active",
        createdAt: now,
        updatedAt: now,
      });

      await addDoc(collection(db, "notifications"), {
        userId,
        type: "business",
        title: "Business Account Created",
        message: `${companyName} was created as a RoadLink Business account.`,
        read: false,
        createdAt: now,
        actionUrl: "/business",
      });

      setCompanyName("");
      setIndustry("");
      setEmployees("");
      setMonthlyBudget("");
      setStatus("Business account created.");
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "Could not create business account.");
    } finally {
      setSaving(false);
    }
  }

  async function createBusinessTrip() {
    if (!activeBusiness?.id) {
      setStatus("Create a business account first.");
      return;
    }

    if (!employeeEmail.trim() || !from.trim() || !to.trim()) {
      setStatus("Employee email, origin and destination are required.");
      return;
    }

    try {
      setSaving(true);
      setStatus("");

      const now = new Date().toISOString();

      await addDoc(collection(db, "businessTrips"), {
        businessId: activeBusiness.id,
        companyName: activeBusiness.companyName || "",
        ownerId: userId,
        ownerEmail: userEmail,
        employeeName: employeeName.trim(),
        employeeEmail: employeeEmail.trim(),
        from: from.trim(),
        to: to.trim(),
        purpose: purpose.trim(),
        department: department.trim(),
        costCenter: costCenter.trim(),
        estimatedCost: Number(estimatedCost || 0),
        status: "pending",
        createdAt: now,
        updatedAt: now,
      });

      await addDoc(collection(db, "notifications"), {
        userId,
        type: "business",
        title: "Business Trip Created",
        message: `A corporate trip was created for ${employeeEmail}.`,
        read: false,
        createdAt: now,
        actionUrl: "/business",
      });

      setEmployeeName("");
      setEmployeeEmail("");
      setFrom("");
      setTo("");
      setPurpose("");
      setDepartment("");
      setCostCenter("");
      setEstimatedCost("");
      setStatus("Business trip request created.");
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "Could not create business trip.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topBar">
          <Link href="/dashboard" className="navButton">← Dashboard</Link>
          <Link href="/analytics-center" className="navButton">Analytics</Link>
          <Link href="/trip-history" className="navButton">Trip History</Link>
          <Link href="/wallet" className="navButton">Wallet</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Enterprise</p>
            <h1>Business <span>Accounts</span></h1>
            <p className="subtitle">
              Manage corporate travel, employee ride requests, monthly budgets, cost centers and business trip reporting.
            </p>
          </div>

          <div className="businessOrb">
            <strong>🏢</strong>
            <span>{activeBusiness?.companyName || "Business"}</span>
          </div>
        </section>

        {status && <p className="status">{status}</p>}

        <section className="stats">
          <Metric icon="🏢" label="Accounts" value={String(businesses.length)} />
          <Metric icon="🎟️" label="Trips" value={String(stats.totalTrips)} />
          <Metric icon="⏳" label="Pending" value={String(stats.pendingTrips)} />
          <Metric icon="✅" label="Approved" value={String(stats.approvedTrips)} />
          <Metric icon="🏁" label="Completed" value={String(stats.completedTrips)} />
          <Metric icon="💳" label="Spend" value={money(stats.totalSpend)} />
          <Metric icon="📊" label="Budget Left" value={money(stats.budgetLeft)} />
          <Metric icon="👥" label="Employees" value={String(activeBusiness?.employees || 0)} />
        </section>

        <section className="grid">
          <section className="panel">
            <p className="eyebrow">Company Setup</p>
            <h2>Create Business Account</h2>

            <label>Company Name</label>
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Company name" />

            <label>Industry</label>
            <input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Transportation, healthcare, university..." />

            <label>Employees</label>
            <input value={employees} onChange={(e) => setEmployees(e.target.value)} placeholder="Number of employees" inputMode="numeric" />

            <label>Monthly Budget</label>
            <input value={monthlyBudget} onChange={(e) => setMonthlyBudget(e.target.value)} placeholder="Monthly travel budget" inputMode="decimal" />

            <button onClick={createBusinessAccount} disabled={saving}>
              {saving ? "Saving..." : "Create Business Account"}
            </button>
          </section>

          <section className="panel">
            <p className="eyebrow">Corporate Ride</p>
            <h2>Create Employee Trip</h2>

            <label>Employee Name</label>
            <input value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} placeholder="Employee name" />

            <label>Employee Email</label>
            <input value={employeeEmail} onChange={(e) => setEmployeeEmail(e.target.value)} placeholder="employee@company.com" />

            <label>From</label>
            <input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="Pickup location" />

            <label>To</label>
            <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Destination" />

            <label>Purpose</label>
            <input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Meeting, airport, field work..." />

            <label>Department</label>
            <input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Sales, HR, Operations..." />

            <label>Cost Center</label>
            <input value={costCenter} onChange={(e) => setCostCenter(e.target.value)} placeholder="Cost center code" />

            <label>Estimated Cost</label>
            <input value={estimatedCost} onChange={(e) => setEstimatedCost(e.target.value)} placeholder="Estimated trip cost" inputMode="decimal" />

            <button onClick={createBusinessTrip} disabled={saving || !activeBusiness}>
              {saving ? "Saving..." : "Create Business Trip"}
            </button>
          </section>
        </section>

        <section className="panel">
          <p className="eyebrow">Active Business</p>
          <h2>{activeBusiness?.companyName || "No Business Account Yet"}</h2>

          {activeBusiness ? (
            <div className="infoGrid">
              <Info label="Owner" value={activeBusiness.ownerEmail || userEmail} />
              <Info label="Industry" value={activeBusiness.industry || "Not added"} />
              <Info label="Employees" value={String(activeBusiness.employees || 0)} />
              <Info label="Monthly Budget" value={money(activeBusiness.monthlyBudget)} />
              <Info label="Status" value={activeBusiness.status || "active"} />
              <Info label="Budget Left" value={money(stats.budgetLeft)} />
            </div>
          ) : (
            <div className="empty">
              <div className="emptyIcon">🏢</div>
              <h3>No business account</h3>
              <p>Create your first RoadLink Business account to manage corporate rides.</p>
            </div>
          )}
        </section>

        <section className="panel">
          <p className="eyebrow">Business Trips</p>
          <h2>Corporate Travel Requests</h2>

          {trips.length === 0 ? (
            <div className="empty">
              <div className="emptyIcon">🎟️</div>
              <h3>No business trips yet</h3>
              <p>Employee trip requests will appear here.</p>
            </div>
          ) : (
            <div className="tripList">
              {trips.map((trip) => (
                <article key={trip.id} className="tripCard">
                  <div className="tripIcon">🏢</div>

                  <div>
                    <div className="tripTop">
                      <div>
                        <h3>{trip.from || "Origin"} → {trip.to || "Destination"}</h3>
                        <p>{trip.employeeName || "Employee"} · {trip.employeeEmail}</p>
                      </div>

                      <strong>{money(trip.estimatedCost)}</strong>
                    </div>

                    <div className="meta">
                      <span>{trip.status || "pending"}</span>
                      <span>{trip.department || "Department"}</span>
                      <span>{trip.costCenter || "Cost Center"}</span>
                      <span>{trip.purpose || "Business travel"}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>

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
        .tripCard {
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
        .tripTop strong {
          color: #22c55e;
        }

        .subtitle,
        .empty p,
        .tripTop p {
          color: #a1a1aa;
          max-width: 760px;
          line-height: 1.5;
          font-size: 18px;
          margin: 0;
        }

        .businessOrb {
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
          padding: 14px;
        }

        .businessOrb strong {
          font-size: 42px;
        }

        .businessOrb span {
          color: #22c55e;
          font-weight: 900;
          font-size: 12px;
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
          font-weight: 900;
          margin: 14px 0 8px;
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

        button {
          width: 100%;
          margin-top: 18px;
          padding: 16px;
          border-radius: 999px;
          border: none;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          font-weight: 900;
          cursor: pointer;
        }

        button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .infoGrid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }

        .info {
          padding: 14px;
          border-radius: 18px;
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
          display: block;
          color: white;
          overflow-wrap: anywhere;
        }

        .tripList {
          display: grid;
          gap: 14px;
        }

        .tripCard {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 14px;
          padding: 18px;
          border-radius: 22px;
          box-shadow: none;
        }

        .tripIcon {
          width: 54px;
          height: 54px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 26px;
        }

        .tripTop {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: flex-start;
          margin-bottom: 12px;
        }

        .tripTop h3 {
          margin: 0 0 5px;
          font-size: 20px;
          overflow-wrap: anywhere;
        }

        .tripTop strong {
          font-size: 22px;
          white-space: nowrap;
        }

        .meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .meta span {
          color: #d4d4d8;
          padding: 8px 11px;
          border-radius: 999px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          font-size: 13px;
          font-weight: 900;
          text-transform: capitalize;
        }

        .empty {
          min-height: 220px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .emptyIcon {
          width: 82px;
          height: 82px;
          border-radius: 50%;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 38px;
          margin-bottom: 16px;
        }

        @media (max-width: 900px) {
          .hero,
          .grid,
          .tripTop {
            grid-template-columns: 1fr;
            flex-direction: column;
            align-items: flex-start;
          }

          .stats,
          .infoGrid {
            grid-template-columns: 1fr;
          }

          h1 {
            font-size: 44px;
          }

          .tripCard {
            grid-template-columns: 1fr;
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
