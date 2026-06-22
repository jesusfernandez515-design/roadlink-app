"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../../lib/firebase";

type BasicItem = {
  id: string;
  status?: string;
  role?: string;
  price?: number;
  amount?: number;
  seatsBooked?: number;
  monthlyRevenue?: number;
  estimatedMonthlyRevenue?: number;
  contractValue?: number;
  requestedAmount?: number;
  committedAmount?: number;
  receivedAmount?: number;
  targetCheckSize?: number;
  estimatedOffer?: number;
  franchiseFee?: number;
  monthlyRoyalty?: number;
  monthlyRevenuePotential?: number;
  createdAt?: string;
};

type AdminModule = {
  title: string;
  href: string;
  icon: string;
  description: string;
  tag: string;
};

export default function AdminPage() {
  const [users, setUsers] = useState<BasicItem[]>([]);
  const [rides, setRides] = useState<BasicItem[]>([]);
  const [bookings, setBookings] = useState<BasicItem[]>([]);
  const [reports, setReports] = useState<BasicItem[]>([]);
  const [corporate, setCorporate] = useState<BasicItem[]>([]);
  const [universities, setUniversities] = useState<BasicItem[]>([]);
  const [airports, setAirports] = useState<BasicItem[]>([]);
  const [government, setGovernment] = useState<BasicItem[]>([]);
  const [partnerships, setPartnerships] = useState<BasicItem[]>([]);
  const [funding, setFunding] = useState<BasicItem[]>([]);
  const [vc, setVc] = useState<BasicItem[]>([]);
  const [acquisitions, setAcquisitions] = useState<BasicItem[]>([]);
  const [expansion, setExpansion] = useState<BasicItem[]>([]);
  const [franchise, setFranchise] = useState<BasicItem[]>([]);
  const [message, setMessage] = useState("Loading RoadLink admin...");

  useEffect(() => {
    const listen = <T,>(name: string, setter: (items: T[]) => void) =>
      onSnapshot(
        query(collection(db, name)),
        (snapshot) => {
          setter(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as T[]);
          setMessage("");
        },
        () => {
          setter([]);
          setMessage("");
        }
      );

    const unsubs = [
      listen<BasicItem>("users", setUsers),
      listen<BasicItem>("rides", setRides),
      listen<BasicItem>("bookings", setBookings),
      listen<BasicItem>("reports", setReports),
      listen<BasicItem>("corporateAccounts", setCorporate),
      listen<BasicItem>("universityPrograms", setUniversities),
      listen<BasicItem>("airportPartnerships", setAirports),
      listen<BasicItem>("governmentContracts", setGovernment),
      listen<BasicItem>("partnerships", setPartnerships),
      listen<BasicItem>("fundingRounds", setFunding),
      listen<BasicItem>("ventureCapital", setVc),
      listen<BasicItem>("acquisitionTargets", setAcquisitions),
      listen<BasicItem>("expansionMarkets", setExpansion),
      listen<BasicItem>("franchisePartners", setFranchise),
    ];

    return () => unsubs.forEach((unsub) => unsub());
  }, []);

  const metrics = useMemo(() => {
    const bookingRevenue = bookings.reduce(
      (total, item) =>
        total + Number(item.price || item.amount || 0) * Number(item.seatsBooked || 1),
      0
    );

    const enterpriseRevenue = [
      ...corporate,
      ...universities,
      ...airports,
      ...government,
      ...partnerships,
    ].reduce(
      (total, item) =>
        total +
        Number(item.monthlyRevenue || item.estimatedMonthlyRevenue || 0),
      0
    );

    const fundingReceived = funding.reduce(
      (total, item) => total + Number(item.receivedAmount || 0),
      0
    );

    const fundingCommitted = funding.reduce(
      (total, item) => total + Number(item.committedAmount || 0),
      0
    );

    const vcPipeline = vc.reduce(
      (total, item) => total + Number(item.targetCheckSize || 0),
      0
    );

    const acquisitionValue = acquisitions.reduce(
      (total, item) => total + Number(item.estimatedOffer || 0),
      0
    );

    const franchiseRevenue = franchise.reduce(
      (total, item) =>
        total + Number(item.franchiseFee || 0) + Number(item.monthlyRoyalty || 0),
      0
    );

    const expansionRevenue = expansion.reduce(
      (total, item) => total + Number(item.monthlyRevenuePotential || 0),
      0
    );

    const activeUsers = users.filter((item) => item.status === "active" || item.role).length;
    const activeRides = rides.filter((item) => item.status !== "cancelled").length;
    const openReports = reports.filter((item) => !item.status || item.status === "open").length;

    const enterpriseClients =
      corporate.length +
      universities.length +
      airports.length +
      government.length +
      partnerships.length;

    const executiveScore = Math.max(
      Math.min(
        users.length * 2 +
          rides.length * 3 +
          bookings.length * 4 +
          enterpriseClients * 6 +
          Math.round(bookingRevenue / 100) +
          Math.round(enterpriseRevenue / 500) +
          Math.round(fundingReceived / 5000) -
          openReports * 4,
        100
      ),
      0
    );

    return {
      bookingRevenue,
      enterpriseRevenue,
      fundingReceived,
      fundingCommitted,
      vcPipeline,
      acquisitionValue,
      franchiseRevenue,
      expansionRevenue,
      activeUsers,
      activeRides,
      openReports,
      enterpriseClients,
      executiveScore,
    };
  }, [
    users,
    rides,
    bookings,
    reports,
    corporate,
    universities,
    airports,
    government,
    partnerships,
    funding,
    vc,
    acquisitions,
    expansion,
    franchise,
  ]);

  const executiveModules: AdminModule[] = [
    { title: "Executive Command", href: "/admin/executive", icon: "🧠", description: "Global command center for RoadLink decisions.", tag: "Executive" },
    { title: "CEO Dashboard", href: "/admin/ceo-dashboard", icon: "👑", description: "Founder level snapshot of the company.", tag: "CEO" },
    { title: "Investor Board", href: "/admin/investor-board", icon: "📊", description: "Investor-facing company performance board.", tag: "Investors" },
    { title: "Analytics", href: "/admin/analytics", icon: "📈", description: "Platform metrics and operating analytics.", tag: "Data" },
  ];

  const growthModules: AdminModule[] = [
    { title: "Growth Intelligence", href: "/admin/growth-intelligence", icon: "🚀", description: "Acquisition, activation, conversion and retention.", tag: "Growth" },
    { title: "Market Intelligence", href: "/admin/market-intelligence", icon: "🌎", description: "Market signals, demand and expansion insight.", tag: "Market" },
    { title: "Dynamic Pricing", href: "/admin/dynamic-pricing", icon: "💸", description: "Pricing intelligence and demand-based pricing.", tag: "Pricing" },
    { title: "Loyalty Center", href: "/admin/loyalty", icon: "💚", description: "Passenger loyalty and rewards programs.", tag: "Retention" },
    { title: "Referral Center", href: "/admin/referrals", icon: "🔁", description: "Referral campaigns and viral growth.", tag: "Viral" },
    { title: "Driver Rewards", href: "/admin/driver-rewards", icon: "🏆", description: "Driver incentives and reward strategy.", tag: "Drivers" },
  ];

  const enterpriseModules: AdminModule[] = [
    { title: "CRM Center", href: "/admin/crm", icon: "📇", description: "Contacts, leads, notes and next actions.", tag: "CRM" },
    { title: "Sales Pipeline", href: "/admin/sales-pipeline", icon: "🧾", description: "Deals, proposals, negotiation and close rate.", tag: "Sales" },
    { title: "Enterprise Revenue", href: "/admin/enterprise-revenue", icon: "🏦", description: "MRR, ARR and enterprise revenue portfolio.", tag: "Revenue" },
    { title: "Corporate Accounts", href: "/admin/corporate-accounts", icon: "🏢", description: "Enterprise clients and employee travel accounts.", tag: "Corporate" },
    { title: "University Program", href: "/admin/university-program", icon: "🎓", description: "Campus partnerships and student travel.", tag: "Campus" },
    { title: "Airport Partnerships", href: "/admin/airport-partnerships", icon: "✈️", description: "Airport and traveler transportation partnerships.", tag: "Airports" },
    { title: "Government Contracts", href: "/admin/government-contracts", icon: "🏛️", description: "Municipal, state and public sector contracts.", tag: "Government" },
    { title: "Partnerships", href: "/admin/partnerships", icon: "🤝", description: "Business development and strategic partners.", tag: "Partners" },
  ];

  const investmentModules: AdminModule[] = [
    { title: "Investor Relations", href: "/admin/investor-relations", icon: "🗣️", description: "Investor updates and traction reports.", tag: "IR" },
    { title: "Funding Center", href: "/admin/funding", icon: "💰", description: "Capital requested, committed and received.", tag: "Funding" },
    { title: "Venture Capital", href: "/admin/venture-capital", icon: "🦄", description: "VC pipeline, diligence and term sheets.", tag: "VC" },
    { title: "Acquisition Center", href: "/admin/acquisition", icon: "🏷️", description: "Strategic buyers, M&A and exit pipeline.", tag: "M&A" },
    { title: "IPO Readiness", href: "/admin/ipo-readiness", icon: "🏛️", description: "Public company checklist and IPO readiness.", tag: "IPO" },
  ];

  const expansionModules: AdminModule[] = [
    { title: "Expansion Center", href: "/admin/expansion", icon: "🗺️", description: "States, cities, launch readiness and ROI.", tag: "Expansion" },
    { title: "Franchise Center", href: "/admin/franchise", icon: "🏪", description: "Regional operators, territories and royalties.", tag: "Franchise" },
  ];

  function money(value: number) {
    return `$${Math.round(value).toLocaleString()}`;
  }

  return (
    <main className="page">
      <section className="container">
        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Executive Super Dashboard</p>
            <h1>Admin <span>Command Center</span></h1>
            <p className="subtitle">
              Control growth, enterprise revenue, partnerships, investment, expansion,
              drivers, passengers, safety, pricing and executive performance from one place.
            </p>
          </div>

          <div className={metrics.executiveScore >= 60 ? "scoreOrb" : "scoreOrb warningScore"}>
            <strong>{metrics.executiveScore}</strong>
            <span>Executive Score</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="👥" label="Users" value={users.length.toLocaleString()} />
          <Metric icon="🚘" label="Rides" value={rides.length.toLocaleString()} />
          <Metric icon="🎟️" label="Bookings" value={bookings.length.toLocaleString()} />
          <Metric icon="💵" label="Booking Revenue" value={money(metrics.bookingRevenue)} />
          <Metric icon="🏢" label="Enterprise Clients" value={String(metrics.enterpriseClients)} />
          <Metric icon="🏦" label="Enterprise MRR" value={money(metrics.enterpriseRevenue)} />
          <Metric icon="💰" label="Funding Received" value={money(metrics.fundingReceived)} />
          <Metric icon="🦄" label="VC Pipeline" value={money(metrics.vcPipeline)} />
          <Metric icon="🏷️" label="Acquisition Value" value={money(metrics.acquisitionValue)} />
          <Metric icon="🗺️" label="Expansion Potential" value={money(metrics.expansionRevenue)} />
          <Metric icon="🏪" label="Franchise Revenue" value={money(metrics.franchiseRevenue)} />
          <Metric icon="⚠️" label="Open Reports" value={String(metrics.openReports)} />
        </section>

        <AdminSection title="Executive" subtitle="Founder, CEO, investor and command dashboards." modules={executiveModules} />
        <AdminSection title="Growth & Marketplace" subtitle="Growth, pricing, loyalty, referrals and driver incentives." modules={growthModules} />
        <AdminSection title="Enterprise" subtitle="CRM, sales, corporate, universities, airports, government and revenue." modules={enterpriseModules} />
        <AdminSection title="Investment" subtitle="Investor relations, funding, venture capital, acquisition and IPO readiness." modules={investmentModules} />
        <AdminSection title="Expansion" subtitle="Market expansion, franchise territories and regional operators." modules={expansionModules} />
      </section>

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          color: white;
          padding: 24px;
          padding-bottom: 140px;
          font-family: Arial, sans-serif;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.22), transparent 34%),
            radial-gradient(circle at bottom left, rgba(59,130,246,0.16), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
        }

        .container {
          max-width: 1450px;
          margin: auto;
        }

        .hero,
        .metric,
        .moduleCard,
        .sectionPanel {
          background: rgba(8,13,25,0.92);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 24px 80px rgba(0,0,0,0.55);
          backdrop-filter: blur(16px);
        }

        .hero {
          border-radius: 36px;
          padding: 36px;
          margin-bottom: 24px;
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
          font-size: 62px;
          line-height: 0.98;
          margin: 0 0 16px;
        }

        h1 span,
        h2,
        .metricValue {
          color: #22c55e;
        }

        .subtitle,
        .sectionSubtitle,
        .moduleCard p {
          color: #a1a1aa;
          line-height: 1.55;
        }

        .scoreOrb {
          min-width: 122px;
          height: 122px;
          border-radius: 50%;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          text-align: center;
        }

        .warningScore {
          background: rgba(239,68,68,0.12);
          border-color: rgba(239,68,68,0.35);
        }

        .scoreOrb strong {
          color: #22c55e;
          font-size: 38px;
          font-weight: 900;
        }

        .warningScore strong {
          color: #fca5a5;
        }

        .scoreOrb span {
          color: #a1a1aa;
          font-size: 11px;
          font-weight: 900;
        }

        .message {
          color: #22c55e;
          font-weight: 900;
          margin: 16px 0;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-bottom: 24px;
        }

        .metric {
          border-radius: 24px;
          padding: 18px;
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

        .sectionPanel {
          border-radius: 32px;
          padding: 28px;
          margin-bottom: 24px;
        }

        .sectionTop {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          align-items: flex-end;
          margin-bottom: 18px;
        }

        .sectionTop h2 {
          font-size: 34px;
          margin: 0 0 8px;
        }

        .sectionSubtitle {
          margin: 0;
        }

        .moduleCount {
          color: #22c55e;
          font-weight: 900;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          padding: 10px 14px;
          border-radius: 999px;
          white-space: nowrap;
        }

        .moduleGrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
        }

        .moduleCard {
          display: block;
          min-height: 190px;
          border-radius: 24px;
          padding: 20px;
          text-decoration: none;
          color: white;
          box-shadow: none;
          transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease;
        }

        .moduleCard:hover {
          transform: translateY(-3px);
          border-color: rgba(34,197,94,0.45);
          background: rgba(34,197,94,0.08);
        }

        .moduleTop {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          margin-bottom: 16px;
        }

        .moduleIcon {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 25px;
        }

        .moduleTag {
          color: #22c55e;
          font-size: 11px;
          font-weight: 900;
          padding: 7px 10px;
          border-radius: 999px;
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.28);
        }

        .moduleCard h3 {
          margin: 0 0 10px;
          font-size: 20px;
        }

        .moduleCard p {
          margin: 0;
          font-size: 14px;
        }

        @media (max-width: 1180px) {
          .stats,
          .moduleGrid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 720px) {
          .page {
            padding: 16px;
            padding-bottom: 140px;
          }

          .hero,
          .sectionTop {
            flex-direction: column;
            align-items: flex-start;
          }

          .hero {
            padding: 28px;
          }

          h1 {
            font-size: 44px;
          }

          .stats,
          .moduleGrid {
            grid-template-columns: 1fr;
          }

          .sectionPanel {
            padding: 22px;
          }
        }
      `}</style>
    </main>
  );
}

function AdminSection({
  title,
  subtitle,
  modules,
}: {
  title: string;
  subtitle: string;
  modules: AdminModule[];
}) {
  return (
    <section className="sectionPanel">
      <div className="sectionTop">
        <div>
          <h2>{title}</h2>
          <p className="sectionSubtitle">{subtitle}</p>
        </div>

        <span className="moduleCount">{modules.length} modules</span>
      </div>

      <div className="moduleGrid">
        {modules.map((item) => (
          <Link key={item.href} href={item.href} className="moduleCard">
            <div className="moduleTop">
              <div className="moduleIcon">{item.icon}</div>
              <span className="moduleTag">{item.tag}</span>
            </div>

            <h3>{item.title}</h3>
            <p>{item.description}</p>
          </Link>
        ))}
      </div>
    </section>
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
      <div className="metricIcon">{icon}</div>
      <span className="metricLabel">{label}</span>
      <div className="metricValue">{value}</div>
    </div>
  );
        }
