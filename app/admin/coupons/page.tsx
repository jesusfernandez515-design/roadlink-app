"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";

type CouponType = "percent" | "fixed";
type CouponAudience = "all" | "drivers" | "passengers" | "new_users";
type CouponStatus = "active" | "paused" | "expired";

type Coupon = {
  id: string;
  code?: string;
  title?: string;
  description?: string;
  type?: CouponType;
  discount?: number;
  audience?: CouponAudience;
  status?: CouponStatus;
  active?: boolean;
  maxUses?: number;
  usedCount?: number;
  minTripAmount?: number;
  expiresAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [selected, setSelected] = useState<Coupon | null>(null);
  const [message, setMessage] = useState("Loading coupons...");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | CouponStatus>("all");

  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<CouponType>("percent");
  const [discount, setDiscount] = useState(10);
  const [audience, setAudience] = useState<CouponAudience>("all");
  const [maxUses, setMaxUses] = useState(100);
  const [minTripAmount, setMinTripAmount] = useState(0);
  const [expiresAt, setExpiresAt] = useState("");

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "coupons")),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as Coupon[];

        data.sort((a, b) =>
          String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
        );

        setCoupons(data);

        setSelected((current) => {
          if (!current) return data[0] || null;
          return data.find((item) => item.id === current.id) || data[0] || null;
        });

        setMessage("");
      },
      (error) => setMessage(error.message)
    );

    return () => unsubscribe();
  }, []);

  const filteredCoupons = useMemo(() => {
    const text = search.toLowerCase().trim();

    return coupons.filter((coupon) => {
      const currentStatus = getCouponStatus(coupon);

      const matchesFilter = filter === "all" || currentStatus === filter;

      const matchesSearch =
        !text ||
        coupon.code?.toLowerCase().includes(text) ||
        coupon.title?.toLowerCase().includes(text) ||
        coupon.description?.toLowerCase().includes(text) ||
        coupon.audience?.toLowerCase().includes(text) ||
        coupon.id.toLowerCase().includes(text);

      return matchesFilter && matchesSearch;
    });
  }, [coupons, search, filter]);

  const activeCount = coupons.filter((item) => getCouponStatus(item) === "active").length;
  const pausedCount = coupons.filter((item) => getCouponStatus(item) === "paused").length;
  const expiredCount = coupons.filter((item) => getCouponStatus(item) === "expired").length;
  const totalUses = coupons.reduce((total, item) => total + Number(item.usedCount || 0), 0);

  function generateCode() {
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    setCode(`ROAD${random}`);
  }

  function getCouponStatus(coupon: Coupon): CouponStatus {
    if (coupon.status === "paused" || coupon.active === false) return "paused";

    if (coupon.expiresAt) {
      const date = new Date(coupon.expiresAt);
      if (!Number.isNaN(date.getTime()) && date.getTime() < Date.now()) return "expired";
    }

    if (Number(coupon.maxUses || 0) > 0 && Number(coupon.usedCount || 0) >= Number(coupon.maxUses || 0)) {
      return "expired";
    }

    return "active";
  }

  function dateText(value?: string) {
    if (!value) return "No expiration";
    try {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "No expiration";
      return date.toLocaleDateString();
    } catch {
      return "No expiration";
    }
  }

  async function createCoupon() {
    if (!code.trim() || !title.trim()) {
      setMessage("Coupon code and title are required.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const cleanCode = code.trim().toUpperCase();
      const now = new Date().toISOString();

      await addDoc(collection(db, "coupons"), {
        code: cleanCode,
        title: title.trim(),
        description: description.trim(),
        type,
        discount: Number(discount || 0),
        audience,
        status: "active",
        active: true,
        maxUses: Number(maxUses || 0),
        usedCount: 0,
        minTripAmount: Number(minTripAmount || 0),
        expiresAt: expiresAt || "",
        createdAt: now,
        updatedAt: now,
      });

      await addDoc(collection(db, "auditLogs"), {
        action: "Coupon Created",
        targetType: "coupon",
        targetId: cleanCode,
        details: `Coupon ${cleanCode} was created.`,
        severity: "success",
        createdAt: now,
      });

      setCode("");
      setTitle("");
      setDescription("");
      setType("percent");
      setDiscount(10);
      setAudience("all");
      setMaxUses(100);
      setMinTripAmount(0);
      setExpiresAt("");

      setMessage("Coupon created successfully.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not create coupon.");
    } finally {
      setSaving(false);
    }
  }

  async function updateCoupon(coupon: Coupon, updates: Partial<Coupon>) {
    try {
      setSaving(true);
      setMessage("");

      const now = new Date().toISOString();

      await setDoc(
        doc(db, "coupons", coupon.id),
        {
          ...updates,
          updatedAt: now,
        },
        { merge: true }
      );

      await addDoc(collection(db, "auditLogs"), {
        action: "Coupon Updated",
        targetType: "coupon",
        targetId: coupon.id,
        details: `Coupon ${coupon.code || coupon.id} was updated.`,
        severity: updates.status === "paused" || updates.active === false ? "warning" : "success",
        createdAt: now,
      });

      setMessage("Coupon updated successfully.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not update coupon.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin Home</Link>
          <Link href="/admin/marketing" className="miniButton">Marketing</Link>
          <Link href="/admin/notifications" className="miniButton">Notifications</Link>
          <Link href="/admin/revenue" className="miniButton">Revenue</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Admin</p>
            <h1>Coupons <span>Center</span></h1>
            <p className="subtitle">
              Create promo codes, control discounts, target drivers or passengers,
              track usage, pause campaigns, and boost RoadLink growth.
            </p>
          </div>

          <div className="heroIcon">🎁</div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="🎁" label="Total Coupons" value={String(coupons.length)} />
          <Metric icon="🟢" label="Active" value={String(activeCount)} />
          <Metric icon="⏸️" label="Paused" value={String(pausedCount)} />
          <Metric icon="⌛" label="Expired" value={String(expiredCount)} />
          <Metric icon="🔥" label="Total Uses" value={String(totalUses)} />
          <Metric icon="📋" label="Filtered" value={String(filteredCoupons.length)} />
        </section>

        <section className="createCard">
          <p className="eyebrow">Create Coupon</p>
          <h2>New Promotion</h2>

          <div className="formGrid">
            <div className="codeRow">
              <input
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="Coupon code"
              />
              <button type="button" onClick={generateCode}>Generate</button>
            </div>

            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Coupon title"
            />

            <select value={type} onChange={(event) => setType(event.target.value as CouponType)}>
              <option value="percent">Percent Discount</option>
              <option value="fixed">Fixed Discount</option>
            </select>

            <input
              type="number"
              value={discount}
              onChange={(event) => setDiscount(Number(event.target.value))}
              placeholder="Discount"
            />

            <select value={audience} onChange={(event) => setAudience(event.target.value as CouponAudience)}>
              <option value="all">All Users</option>
              <option value="drivers">Drivers</option>
              <option value="passengers">Passengers</option>
              <option value="new_users">New Users</option>
            </select>

            <input
              type="number"
              value={maxUses}
              onChange={(event) => setMaxUses(Number(event.target.value))}
              placeholder="Max uses"
            />

            <input
              type="number"
              value={minTripAmount}
              onChange={(event) => setMinTripAmount(Number(event.target.value))}
              placeholder="Minimum trip amount"
            />

            <input
              type="date"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
            />
          </div>

          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Coupon description..."
          />

          <button onClick={createCoupon} disabled={saving} className="createButton">
            {saving ? "Creating..." : "Create Coupon"}
          </button>
        </section>

        <section className="filtersCard">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by code, title, audience, or ID..."
          />

          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as "all" | CouponStatus)}
          >
            <option value="all">All coupons</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="expired">Expired</option>
          </select>
        </section>

        <section className="adminGrid">
          <section className="couponsCard">
            <p className="eyebrow">Coupons</p>
            <h2>Promotion Codes</h2>

            {filteredCoupons.length === 0 ? (
              <div className="empty">
                <h3>No coupons found</h3>
                <p>Create your first coupon above.</p>
              </div>
            ) : (
              <div className="couponList">
                {filteredCoupons.map((coupon) => {
                  const status = getCouponStatus(coupon);

                  return (
                    <button
                      key={coupon.id}
                      onClick={() => setSelected(coupon)}
                      className={selected?.id === coupon.id ? "couponRow activeCoupon" : "couponRow"}
                    >
                      <div className="couponIcon">🎁</div>

                      <div className="couponInfo">
                        <strong>{coupon.code || "COUPON"}</strong>
                        <span>{coupon.title || "Promotion"}</span>
                        <small>
                          {coupon.type === "fixed" ? "$" : ""}
                          {Number(coupon.discount || 0)}
                          {coupon.type === "percent" ? "%" : ""} • Used {Number(coupon.usedCount || 0)}
                        </small>
                      </div>

                      <em className={`status ${status}`}>{status}</em>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="detailsCard">
            {selected ? (
              <>
                <div className="sectionHeader">
                  <div>
                    <p className="eyebrow">Selected Coupon</p>
                    <h2>{selected.code || "COUPON"}</h2>
                    <p className="email">{selected.title || "Promotion"}</p>
                  </div>

                  <span className={`statusPill ${getCouponStatus(selected)}`}>
                    {getCouponStatus(selected)}
                  </span>
                </div>

                <div className="discountBox">
                  <span>Discount</span>
                  <strong>
                    {selected.type === "fixed" ? "$" : ""}
                    {Number(selected.discount || 0)}
                    {selected.type === "percent" ? "%" : ""}
                  </strong>
                </div>

                <div className="infoGrid">
                  <Info label="Coupon ID" value={selected.id} />
                  <Info label="Code" value={selected.code || "Not available"} />
                  <Info label="Title" value={selected.title || "Not available"} />
                  <Info label="Type" value={selected.type || "percent"} />
                  <Info label="Audience" value={selected.audience || "all"} />
                  <Info label="Status" value={getCouponStatus(selected)} />
                  <Info label="Used Count" value={String(selected.usedCount || 0)} />
                  <Info label="Max Uses" value={String(selected.maxUses || 0)} />
                  <Info label="Min Trip Amount" value={`$${Number(selected.minTripAmount || 0)}`} />
                  <Info label="Expires" value={dateText(selected.expiresAt)} />
                  <Info label="Created" value={selected.createdAt ? new Date(selected.createdAt).toLocaleString() : "Not available"} />
                  <Info label="Updated" value={selected.updatedAt ? new Date(selected.updatedAt).toLocaleString() : "Not available"} />
                </div>

                <div className="descriptionBox">
                  <strong>Description</strong>
                  <p>{selected.description || "No description provided."}</p>
                </div>

                <div className="actionRow">
                  <button
                    className="activateButton"
                    onClick={() => updateCoupon(selected, { active: true, status: "active" })}
                    disabled={saving}
                  >
                    Activate
                  </button>

                  <button
                    className="pauseButton"
                    onClick={() => updateCoupon(selected, { active: false, status: "paused" })}
                    disabled={saving}
                  >
                    Pause
                  </button>

                  <button
                    className="expireButton"
                    onClick={() => updateCoupon(selected, { active: false, status: "expired" })}
                    disabled={saving}
                  >
                    Expire
                  </button>
                </div>
              </>
            ) : (
              <div className="empty">
                <h3>Select a coupon</h3>
                <p>Choose a coupon to manage it.</p>
              </div>
            )}
          </section>
        </section>
      </section>

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.22), transparent 34%),
            radial-gradient(circle at bottom left, rgba(59,130,246,0.12), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          padding: 24px;
          padding-bottom: 140px;
          font-family: Arial, sans-serif;
        }

        .container { max-width: 1180px; margin: auto; }

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

        .hero,
        .metric,
        .createCard,
        .filtersCard,
        .couponsCard,
        .detailsCard {
          background: rgba(8, 13, 25, 0.92);
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

        h1 { font-size: 58px; line-height: 1; margin: 0 0 16px; }

        h1 span,
        h2,
        .metricValue,
        .discountBox strong {
          color: #22c55e;
        }

        h2 { font-size: 32px; margin: 0 0 14px; }

        .subtitle,
        .email,
        .empty p,
        .descriptionBox p {
          color: #a1a1aa;
          line-height: 1.5;
          margin: 0;
          overflow-wrap: anywhere;
        }

        .heroIcon {
          min-width: 92px;
          height: 92px;
          border-radius: 50%;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 42px;
        }

        .message { color: #22c55e; font-weight: 900; margin: 16px 0; }

        .stats {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 14px;
          margin-bottom: 18px;
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

        .metricValue { font-size: 24px; font-weight: 900; }

        .createCard,
        .filtersCard,
        .couponsCard,
        .detailsCard {
          border-radius: 30px;
          padding: 28px;
          margin-bottom: 24px;
        }

        .formGrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }

        .codeRow {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 8px;
        }

        input,
        select,
        textarea {
          width: 100%;
          padding: 15px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
          color: white;
          font-size: 16px;
          outline: none;
        }

        select option { color: black; }

        textarea {
          min-height: 110px;
          resize: vertical;
          margin-top: 12px;
          font-family: Arial, sans-serif;
        }

        .codeRow button,
        .createButton,
        .activateButton,
        .pauseButton,
        .expireButton {
          border-radius: 999px;
          border: none;
          color: white;
          font-weight: 900;
          cursor: pointer;
        }

        .codeRow button {
          padding: 0 14px;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.12);
        }

        .createButton {
          width: 100%;
          margin-top: 14px;
          padding: 16px;
          background: linear-gradient(135deg, #22c55e, #16a34a);
        }

        .filtersCard {
          display: grid;
          grid-template-columns: 1fr 220px;
          gap: 12px;
        }

        .adminGrid {
          display: grid;
          grid-template-columns: 0.9fr 1.4fr;
          gap: 24px;
        }

        .couponList {
          display: grid;
          gap: 12px;
        }

        .couponRow {
          width: 100%;
          display: grid;
          grid-template-columns: 52px 1fr auto;
          gap: 12px;
          align-items: center;
          padding: 14px;
          border-radius: 18px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          color: white;
          cursor: pointer;
          text-align: left;
        }

        .activeCoupon {
          border-color: rgba(34,197,94,0.45);
          background: rgba(34,197,94,0.1);
        }

        .couponIcon {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          border: 1px solid rgba(34,197,94,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }

        .couponInfo { min-width: 0; }

        .couponInfo strong,
        .couponInfo span,
        .couponInfo small {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .couponInfo span,
        .couponInfo small {
          color: #a1a1aa;
          margin-top: 4px;
        }

        .status,
        .statusPill {
          border-radius: 999px;
          padding: 8px 11px;
          font-style: normal;
          font-weight: 900;
          font-size: 12px;
          white-space: nowrap;
          text-transform: capitalize;
        }

        .status.active,
        .statusPill.active {
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .status.paused,
        .statusPill.paused {
          color: #fde68a;
          background: rgba(250,204,21,0.12);
          border: 1px solid rgba(250,204,21,0.35);
        }

        .status.expired,
        .statusPill.expired {
          color: #fca5a5;
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.35);
        }

        .sectionHeader {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 20px;
        }

        .discountBox,
        .descriptionBox {
          padding: 20px;
          border-radius: 22px;
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.35);
          margin-bottom: 20px;
        }

        .discountBox span {
          display: block;
          color: #a1a1aa;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .discountBox strong {
          font-size: 46px;
          font-weight: 900;
        }

        .descriptionBox strong {
          display: block;
          margin-bottom: 8px;
        }

        .infoGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        }

        .infoBox {
          padding: 14px;
          border-radius: 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .infoBox span {
          display: block;
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 6px;
        }

        .infoBox strong {
          overflow-wrap: anywhere;
        }

        .actionRow {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }

        .activateButton,
        .pauseButton,
        .expireButton {
          padding: 15px;
        }

        .activateButton {
          background: linear-gradient(135deg, #22c55e, #16a34a);
        }

        .pauseButton {
          background: linear-gradient(135deg, #f59e0b, #b45309);
        }

        .expireButton {
          background: linear-gradient(135deg, #ef4444, #991b1b);
        }

        button:disabled { opacity: 0.6; cursor: not-allowed; }

        .empty {
          padding: 26px;
          border-radius: 22px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .empty h3 { margin: 0 0 8px; font-size: 24px; }

        @media (max-width: 1100px) {
          .stats { grid-template-columns: repeat(3, 1fr); }
          .formGrid { grid-template-columns: repeat(2, 1fr); }
          .adminGrid { grid-template-columns: 1fr; }
        }

        @media (max-width: 720px) {
          .page { padding: 16px; padding-bottom: 140px; }

          .hero {
            flex-direction: column;
            align-items: flex-start;
            padding: 28px;
          }

          h1 { font-size: 44px; }

          .stats,
          .formGrid,
          .filtersCard,
          .infoGrid,
          .actionRow {
            grid-template-columns: 1fr;
          }

          .couponRow {
            grid-template-columns: 46px 1fr;
          }

          .couponRow .status {
            grid-column: 1 / -1;
            width: fit-content;
          }

          .couponIcon {
            width: 46px;
            height: 46px;
          }

          .sectionHeader {
            flex-direction: column;
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
      <div className="metricIcon">{icon}</div>
      <span className="metricLabel">{label}</span>
      <div className="metricValue">{value}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="infoBox">
      <span>{label}</span>
      <strong>{value || "Not available"}</strong>
    </div>
  );
}
