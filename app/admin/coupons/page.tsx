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
} from "firebase/firestore";
import { db } from "../../../lib/firebase";

type CouponType = "fixed" | "percent";
type CouponAudience = "all" | "new_users" | "drivers" | "passengers";

type Coupon = {
  id: string;
  code?: string;
  title?: string;
  description?: string;
  type?: CouponType;
  amount?: number;
  audience?: CouponAudience;
  active?: boolean;
  maxUses?: number;
  usedCount?: number;
  expiresAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

type Redemption = {
  id: string;
  couponId?: string;
  couponCode?: string;
  userId?: string;
  userEmail?: string;
  bookingId?: string;
  discountAmount?: number;
  createdAt?: string;
};

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [selected, setSelected] = useState<Coupon | null>(null);
  const [message, setMessage] = useState("Loading coupons...");
  const [saving, setSaving] = useState(false);

  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<CouponType>("fixed");
  const [amount, setAmount] = useState(10);
  const [audience, setAudience] = useState<CouponAudience>("all");
  const [maxUses, setMaxUses] = useState(100);
  const [expiresAt, setExpiresAt] = useState("");

  useEffect(() => {
    const unsubCoupons = onSnapshot(
      query(collection(db, "coupons")),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as Coupon[];

        data.sort((a, b) =>
          String(b.createdAt || b.updatedAt || "").localeCompare(
            String(a.createdAt || a.updatedAt || "")
          )
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

    const unsubRedemptions = onSnapshot(
      query(collection(db, "couponRedemptions")),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as Redemption[];

        data.sort((a, b) =>
          String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
        );

        setRedemptions(data);
      },
      (error) => setMessage(error.message)
    );

    return () => {
      unsubCoupons();
      unsubRedemptions();
    };
  }, []);

  const activeCoupons = coupons.filter((item) => item.active !== false).length;
  const inactiveCoupons = coupons.filter((item) => item.active === false).length;
  const totalUses = redemptions.length;

  const totalDiscountGiven = redemptions.reduce(
    (total, item) => total + Number(item.discountAmount || 0),
    0
  );

  const selectedRedemptions = useMemo(() => {
    if (!selected) return [];
    return redemptions.filter(
      (item) => item.couponId === selected.id || item.couponCode === selected.code
    );
  }, [selected, redemptions]);

  async function createCoupon() {
    if (!code.trim() || !title.trim()) {
      setMessage("Coupon code and title are required.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const now = new Date().toISOString();
      const cleanCode = code.trim().toUpperCase().replace(/\s+/g, "");

      await addDoc(collection(db, "coupons"), {
        code: cleanCode,
        title: title.trim(),
        description: description.trim(),
        type,
        amount: Number(amount || 0),
        audience,
        active: true,
        maxUses: Number(maxUses || 0),
        usedCount: 0,
        expiresAt: expiresAt || "",
        createdAt: now,
        updatedAt: now,
      });

      setCode("");
      setTitle("");
      setDescription("");
      setType("fixed");
      setAmount(10);
      setAudience("all");
      setMaxUses(100);
      setExpiresAt("");

      setMessage("Coupon created successfully.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not create coupon.");
    } finally {
      setSaving(false);
    }
  }

  async function updateCouponStatus(coupon: Coupon, active: boolean) {
    try {
      setSaving(true);
      setMessage("");

      await setDoc(
        doc(db, "coupons", coupon.id),
        {
          active,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      setMessage(active ? "Coupon activated." : "Coupon deactivated.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not update coupon.");
    } finally {
      setSaving(false);
    }
  }

  function couponValue(coupon: Coupon) {
    if (coupon.type === "percent") return `${Number(coupon.amount || 0)}% OFF`;
    return `$${Number(coupon.amount || 0)} OFF`;
  }

  function audienceText(value?: CouponAudience) {
    if (value === "new_users") return "New Users";
    if (value === "drivers") return "Drivers";
    if (value === "passengers") return "Passengers";
    return "All Users";
  }

  function dateText(value?: string) {
    if (!value) return "No expiration";

    try {
      return new Date(value).toLocaleString();
    } catch {
      return "No expiration";
    }
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin Home</Link>
          <Link href="/admin/marketing" className="miniButton">Marketing</Link>
          <Link href="/admin/payments" className="miniButton">Payments</Link>
          <Link href="/admin/notifications" className="miniButton">Notifications</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Admin</p>
            <h1>Coupons <span>Center</span></h1>
            <p className="subtitle">
              Create discount codes, manage active promotions, track redemptions,
              and prepare RoadLink for real payment campaigns.
            </p>
          </div>

          <div className="heroIcon">🎟️</div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="🎟️" label="Coupons" value={String(coupons.length)} />
          <Metric icon="✅" label="Active" value={String(activeCoupons)} />
          <Metric icon="⛔" label="Inactive" value={String(inactiveCoupons)} />
          <Metric icon="📌" label="Redemptions" value={String(totalUses)} />
          <Metric icon="💵" label="Discount Given" value={`$${totalDiscountGiven}`} />
        </section>

        <section className="createCard">
          <p className="eyebrow">Create Coupon</p>
          <h2>New Promotion</h2>

          <div className="formGrid">
            <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="Code: ROAD10" />
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title" />
            <select value={type} onChange={(event) => setType(event.target.value as CouponType)}>
              <option value="fixed">Fixed amount</option>
              <option value="percent">Percent</option>
            </select>
            <input type="number" value={amount} onChange={(event) => setAmount(Number(event.target.value))} placeholder="Amount" />
            <select value={audience} onChange={(event) => setAudience(event.target.value as CouponAudience)}>
              <option value="all">All users</option>
              <option value="new_users">New users</option>
              <option value="drivers">Drivers</option>
              <option value="passengers">Passengers</option>
            </select>
            <input type="number" value={maxUses} onChange={(event) => setMaxUses(Number(event.target.value))} placeholder="Max uses" />
            <input type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
          </div>

          <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Coupon description..." />

          <button className="createButton" onClick={createCoupon} disabled={saving}>
            {saving ? "Saving..." : "Create Coupon"}
          </button>
        </section>

        <section className="adminGrid">
          <div className="couponsCard">
            <p className="eyebrow">Coupons</p>
            <h2>Promotion List</h2>

            {coupons.length === 0 ? (
              <div className="empty">
                <h3>No coupons yet</h3>
                <p>Create your first coupon above.</p>
              </div>
            ) : (
              <div className="couponList">
                {coupons.map((coupon) => (
                  <button
                    key={coupon.id}
                    className={selected?.id === coupon.id ? "couponRow activeCoupon" : "couponRow"}
                    onClick={() => setSelected(coupon)}
                  >
                    <div className="couponIcon">🎟️</div>

                    <div className="couponInfo">
                      <strong>{coupon.code || "COUPON"}</strong>
                      <span>{coupon.title || "Untitled coupon"}</span>
                      <small>{couponValue(coupon)} • {audienceText(coupon.audience)}</small>
                    </div>

                    <em className={coupon.active === false ? "status inactive" : "status active"}>
                      {coupon.active === false ? "Inactive" : "Active"}
                    </em>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="detailsCard">
            {selected ? (
              <>
                <div className="sectionHeader">
                  <div>
                    <p className="eyebrow">Selected Coupon</p>
                    <h2>{selected.code || "Coupon"}</h2>
                    <p className="email">{selected.title || "Untitled coupon"}</p>
                  </div>

                  <span className={selected.active === false ? "statusPill inactive" : "statusPill active"}>
                    {selected.active === false ? "Inactive" : "Active"}
                  </span>
                </div>

                <div className="amountBox">
                  <span>Discount Value</span>
                  <strong>{couponValue(selected)}</strong>
                </div>

                <div className="detailsBox">
                  <strong>Description</strong>
                  <p>{selected.description || "No description provided."}</p>
                </div>

                <div className="infoGrid">
                  <Info label="Coupon ID" value={selected.id} />
                  <Info label="Code" value={selected.code || "Not available"} />
                  <Info label="Type" value={selected.type || "fixed"} />
                  <Info label="Audience" value={audienceText(selected.audience)} />
                  <Info label="Max Uses" value={String(selected.maxUses || 0)} />
                  <Info label="Used Count" value={String(selected.usedCount || selectedRedemptions.length)} />
                  <Info label="Expires" value={dateText(selected.expiresAt)} />
                  <Info label="Created" value={dateText(selected.createdAt)} />
                </div>

                <div className="actionRow">
                  <button className="approveButton" onClick={() => updateCouponStatus(selected, true)} disabled={saving}>
                    Activate
                  </button>

                  <button className="rejectButton" onClick={() => updateCouponStatus(selected, false)} disabled={saving}>
                    Deactivate
                  </button>
                </div>

                <section className="redemptionBox">
                  <p className="eyebrow">Redemptions</p>
                  <h2>Coupon Usage</h2>

                  {selectedRedemptions.length === 0 ? (
                    <div className="empty">
                      <h3>No redemptions yet</h3>
                      <p>Usage history will appear here.</p>
                    </div>
                  ) : (
                    <div className="redemptionList">
                      {selectedRedemptions.map((item) => (
                        <div key={item.id} className="redemptionItem">
                          <strong>{item.userEmail || item.userId || "User"}</strong>
                          <span>Discount: ${Number(item.discountAmount || 0)}</span>
                          <small>{dateText(item.createdAt)}</small>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </>
            ) : (
              <div className="empty">
                <h3>Select a coupon</h3>
                <p>Choose a coupon to manage details.</p>
              </div>
            )}
          </div>
        </section>
      </section>

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.22), transparent 34%),
            radial-gradient(circle at bottom left, rgba(16,185,129,0.12), transparent 35%),
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
        .amountBox strong {
          color: #22c55e;
        }

        h2 { font-size: 32px; margin: 0 0 14px; }

        .subtitle,
        .email,
        .empty p,
        .detailsBox p {
          color: #a1a1aa;
          line-height: 1.5;
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
          grid-template-columns: repeat(5, 1fr);
          gap: 14px;
          margin-bottom: 24px;
        }

        .metric { border-radius: 24px; padding: 18px; }

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
        .couponsCard,
        .detailsCard {
          border-radius: 30px;
          padding: 28px;
        }

        .createCard { margin-bottom: 24px; }

        .formGrid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
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
        }

        .createButton,
        .approveButton,
        .rejectButton {
          padding: 15px;
          border-radius: 999px;
          border: none;
          color: white;
          font-weight: 900;
          cursor: pointer;
        }

        .createButton {
          width: 100%;
          margin-top: 14px;
          background: linear-gradient(135deg, #22c55e, #16a34a);
        }

        .adminGrid {
          display: grid;
          grid-template-columns: 0.9fr 1.4fr;
          gap: 24px;
        }

        .couponList,
        .redemptionList {
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
        }

        .status.active,
        .statusPill.active {
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .status.inactive,
        .statusPill.inactive {
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

        .amountBox,
        .detailsBox,
        .redemptionBox {
          padding: 22px;
          border-radius: 22px;
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.35);
          margin-bottom: 20px;
        }

        .amountBox span {
          display: block;
          color: #a1a1aa;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .amountBox strong { font-size: 44px; font-weight: 900; }

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

        .infoBox strong { overflow-wrap: anywhere; }

        .actionRow {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 20px;
        }

        .approveButton { background: linear-gradient(135deg, #22c55e, #16a34a); }
        .rejectButton { background: linear-gradient(135deg, #ef4444, #991b1b); }

        .redemptionItem {
          padding: 14px;
          border-radius: 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .redemptionItem span,
        .redemptionItem small {
          display: block;
          color: #a1a1aa;
          margin-top: 4px;
        }

        .empty {
          padding: 26px;
          border-radius: 22px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .empty h3 { margin: 0 0 8px; font-size: 24px; }

        button:disabled { opacity: 0.6; cursor: not-allowed; }

        @media (max-width: 1100px) {
          .stats { grid-template-columns: repeat(2, 1fr); }
          .adminGrid { grid-template-columns: 1fr; }
          .formGrid { grid-template-columns: 1fr; }
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

          .sectionHeader { flex-direction: column; }
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
      <strong>{value}</strong>
    </div>
  );
}
