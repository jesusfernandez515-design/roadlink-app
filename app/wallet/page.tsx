"use client";

import Link from "next/link";
import { isPendingBooking, retainedPayment } from "../../lib/wallet-totals";
import { useEffect, useMemo, useState } from "react";
import { auth } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

type Booking = {
  id: string;
  passengerEmail?: string;
  driverId?: string;
  from?: string;
  to?: string;
  status?: string;
  paymentStatus?: string;
  price?: number;
  amount?: number;
  platformFee?: number;
  driverAmount?: number;
  seatsBooked?: number;
  createdAt?: string;
  completedAt?: string;
  paidAt?: string;
};

type WalletTransaction = {
  id: string;
  bookingId?: string;
  rideId?: string;
  driverId?: string;
  driverEmail?: string;
  passengerEmail?: string;
  amount?: number;
  grossAmount?: number;
  refundedCents?: number;
  platformFee?: number;
  type?: string;
  status?: string;
  description?: string;
  createdAt?: string;
};

type PayoutRequest = {
  id: string;
  amount?: number;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  paidAt?: string;
};

type BankingInfo = {
  accountHolder?: string;
  bankName?: string;
  routingNumber?: string;
  accountNumberLast4?: string;
  payoutMethod?: string;
};

type UserProfile = {
  banking?: BankingInfo;
};

export default function WalletPage() {
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [banking, setBanking] = useState<BankingInfo>({});
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([]);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [message, setMessage] = useState("Loading wallet...");
  const [connect, setConnect] = useState<{ connected: boolean; ready: boolean } | null>(null);
  const testConnect = process.env.NEXT_PUBLIC_ROADLINK_ENV === "test";
  const [reads, setReads] = useState<Record<string, boolean>>({});
  const walletReady = ["profile", "bookings", "wallet", "payouts"].every((key) => reads[key]);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    let generation = 0;
    let interval: ReturnType<typeof setInterval> | undefined;
    let controller: AbortController | undefined;
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      const current = ++generation;
      if (interval) clearInterval(interval);
      controller?.abort();
      const active = () => current === generation && auth.currentUser?.uid === user?.uid;
      setConnect(null); setReads({});
      setBanking({}); setBookings([]); setWalletTransactions([]); setPayouts([]);
      setUserId(user?.uid || ""); setUserEmail(user?.email || "");
      if (!user) { setMessage("Inicia sesión con la cuenta del conductor para ver la cartera."); return; }
      let running = false;
      const refresh = async () => {
        if (running || !active()) return;
        running = true;
        controller = new AbortController();
        const signal = controller.signal;
        const timeout = setTimeout(() => controller?.abort(), 15000);
        try {
          setMessage("Consultando la cartera…");
          const token = await Promise.race([
            user.getIdToken(),
            new Promise<never>((_, reject) => signal.addEventListener("abort", () => reject(new Error("La sesión o conexión tardó demasiado. Pulsa Reintentar.")), { once: true })),
          ]);
          if (!active() || signal.aborted) return;
          const response = await fetch("/api/connect/wallet", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "No se pudo consultar la cartera.");
          if (!active()) return;
          setBookings(data.bookings);
          setWalletTransactions(data.walletTransactions.sort((a: WalletTransaction, b: WalletTransaction) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))));
          setPayouts(data.payouts.sort((a: PayoutRequest, b: PayoutRequest) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))));
          setReads({ profile: true, bookings: true, wallet: true, payouts: true });
          setMessage("");
          // Stripe readiness is independent: it must never block wallet balances.
          void fetch("/api/connect/status", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(10000) })
            .then(async (result) => { const state = await result.json(); if (active()) { if (result.ok) setConnect(state); else setMessage(state.error || "Stripe no está disponible."); } })
            .catch(() => { if (active()) setMessage("La cartera cargó, pero Stripe no respondió. Recarga para volver a consultar Connect."); });
        } catch (error) {
          if (active()) {
            setReads({});
            setMessage(signal.aborted ? "La consulta tardó demasiado. Pulsa Reintentar cartera." : error instanceof Error ? error.message : "No se pudo consultar la cartera.");
          }
        } finally { clearTimeout(timeout); running = false; }
      };
      void refresh();
      interval = setInterval(() => { void refresh(); }, 30000);
    });
    return () => { generation++; unsubscribeAuth(); controller?.abort(); if (interval) clearInterval(interval); };
  }, []);

  function bookingGross(booking: Booking) {
    return (
      Number(booking.amount || booking.price || 0) *
      Number(booking.seatsBooked || 1)
    );
  }

  function bookingFee(booking: Booking) {
    return Number(booking.platformFee || Math.round(bookingGross(booking) * 0.12 * 100) / 100);
  }

  function bookingNet(booking: Booking) {
    return Number(booking.driverAmount || Math.max(bookingGross(booking) - bookingFee(booking), 0));
  }

  const completedBookings = useMemo(
    () =>
      bookings.filter((item) =>
        item.paymentStatus === "paid" || item.paymentStatus === "partially_refunded"
      ),
    [bookings]
  );

  const pendingBookings = useMemo(
    () =>
      bookings.filter(isPendingBooking),
    [bookings]
  );

  const walletPendingTransactions = useMemo(
    () =>
      walletTransactions.filter(
        (item) => item.status === "available"
      ),
    [walletTransactions]
  );

  const walletPaidTransactions = useMemo(
    () => walletTransactions.filter((item) => item.status === "paid"),
    [walletTransactions]
  );

  const lifetimeGross = useMemo(
    () => walletTransactions.reduce((total, item) => total + retainedPayment(item).gross, 0),
    [walletTransactions]
  );

  const lifetimeFees = useMemo(
    () => walletTransactions.reduce((total, item) => total + retainedPayment(item).fee, 0),
    [walletTransactions]
  );

  const lifetimeNetFromBookings = useMemo(
    () => walletTransactions.reduce((total, item) => total + retainedPayment(item).net, 0),
    [walletTransactions]
  );

  const walletNet = useMemo(
    () =>
      walletPendingTransactions.reduce(
        (total, item) => total + Number(item.amount || 0),
        0
      ),
    [walletPendingTransactions]
  );

  const pendingBalance = useMemo(
    () => walletTransactions.filter((item) => item.status === "pending_payout").reduce((total, item) => total + Number(item.amount || 0), 0),
    [walletTransactions]
  );

  const totalPaidOut = useMemo(
    () =>
      payouts
        .filter((item) => item.status === "paid")
        .reduce((total, item) => total + Number(item.amount || 0), 0),
    [payouts]
  );

  const activePayoutRequests = useMemo(
    () =>
      payouts
        .filter((item) => item.status === "pending" || item.status === "approved")
        .reduce((total, item) => total + Number(item.amount || 0), 0),
    [payouts]
  );

  const currentBalance = Math.max(
    walletNet,
    0
  );

  const availableBalance = Math.max(currentBalance - activePayoutRequests, 0);
  const latestPayout = payouts[0];

  const bankReady =
    Boolean(banking.accountHolder) &&
    Boolean(banking.bankName) &&
    Boolean(banking.accountNumberLast4);

  const walletActivity = useMemo(() => {
    const transactionActivity = walletTransactions.map((item) => ({
      id: `wallet-${item.id}`,
      title: item.type === "ride_payment" ? "Ride Payment" : "Wallet Transaction",
      subtitle: item.description || "RoadLink wallet activity",
      detail: String(item.status || "pending").toUpperCase(),
      amount: Number(item.amount || 0),
      sign: "+",
      date: item.createdAt || "",
      icon: "💰",
    }));

    const rideActivity = completedBookings.map((booking) => ({
      id: `booking-${booking.id}`,
      title: "Ride Earning",
      subtitle: `${booking.from || "Origin"} → ${booking.to || "Destination"}`,
      detail: booking.passengerEmail || "Passenger",
      amount: bookingNet(booking),
      sign: "+",
      date: booking.completedAt || booking.paidAt || booking.createdAt || "",
      icon: "✅",
    }));

    const payoutActivity = payouts.map((payout) => ({
      id: `payout-${payout.id}`,
      title: payout.status === "reversed" ? "Recuperado por reembolso (pruebas)" : payout.status === "transferred" ? "Enviado a Stripe (pruebas)" : payout.status === "paid" ? "Payout Sent" : "Transferencia pendiente o en revisión",
      subtitle: "Driver payout activity",
      detail: String(payout.status || "pending").toUpperCase(),
      amount: Number(payout.amount || 0),
      sign: ["paid", "transferred"].includes(payout.status || "") ? "-" : "hold",
      date: payout.paidAt || payout.updatedAt || payout.createdAt || "",
      icon: "🏦",
    }));

    const source = transactionActivity.length ? transactionActivity : rideActivity;

    return [...source, ...payoutActivity].sort((a, b) =>
      String(b.date || "").localeCompare(String(a.date || ""))
    );
  }, [completedBookings, payouts, walletTransactions]);

  async function connectAction(mode: "onboard" | "dashboard") {
    if (!auth.currentUser || requesting) return;
    setRequesting(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch("/api/connect/onboarding", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ mode }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo abrir Stripe.");
      const url = new URL(data.url);
      if (url.protocol !== "https:" || !["connect.stripe.com", "dashboard.stripe.com", "accounts.stripe.com"].includes(url.hostname)) throw new Error("Stripe devolvió un enlace no válido.");
      window.location.assign(url.href);
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo abrir Stripe."); }
    finally { setRequesting(false); }
  }

  async function requestPayout() {
    if (!walletReady || requesting || !auth.currentUser) return;
    if (!testConnect) { setMessage("Los retiros aún no están habilitados en este entorno."); return; }
    if (!connect?.ready) { setMessage("Completa primero el registro del conductor en Stripe."); return; }
    const rows = walletTransactions.filter((item) => ["available", "transferring"].includes(item.status || ""));
    if (!rows.length) return;
    setRequesting(true);
    try {
      const token = await auth.currentUser.getIdToken();
      for (const row of rows) {
        const response = await fetch("/api/connect/transfer", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ walletId: row.id }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No se pudo transferir. Reintenta para conciliar la operación.");
      }
      setMessage("Importe enviado a tu saldo Stripe de pruebas. Esto no confirma un depósito bancario. Consulta los retiros en el panel de Stripe.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo completar la transferencia."); }
    finally { setRequesting(false); }
  }

  async function recoverRefund() {
    if (!testConnect || requesting || !auth.currentUser) return;
    setRequesting(true);
    try {
      const token = await auth.currentUser.getIdToken();
      for (const row of walletTransactions.filter(item => item.status === "transfer_review")) {
        const response = await fetch("/api/connect/reconcile", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ walletId: row.id }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "La recuperación requiere revisión.");
      }
      setMessage("Importe de prueba recuperado del saldo Stripe del conductor. Reembolso conciliado.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo conciliar."); }
    finally { setRequesting(false); }
  }

  function money(value?: number) {
    return walletReady ? `$${Number(value || 0).toFixed(2)}` : "—";
  }

  function formatDate(value?: string) {
    if (!value) return "Recently";

    try {
      return new Date(value).toLocaleString();
    } catch {
      return "Recently";
    }
  }

  return (
    <main className="page">
      <section className="hero">
        <div className="topNav">
          <Link href="/dashboard" className="miniButton">Dashboard</Link>
          <Link href="/dashboard/driver" className="miniButton">Driver Dashboard</Link>
          <Link href="/my-rides" className="miniButton">My Rides</Link>
          <Link href="/wallet/settings" className="miniButton">Banking</Link>
        </div>

        <p className="eyebrow">RoadLink Wallet Center</p>
        <h1>Driver <span>Wallet</span></h1>
        <p className="subtitle">
          Track driver earnings, RoadLink fees, pending payouts, paid payouts, wallet transactions and available balance.
        </p>

        <div className="balanceBox">
          <span>Available Balance</span>
          <strong>{money(availableBalance)}</strong>
          <small>
            {latestPayout
              ? `Latest payout: ${String(latestPayout.status || "pending").toUpperCase()}`
              : "No payout requests yet"}
          </small>
        </div>
      </section>

      {message && <p className="message" role="status">{message}</p>}
      {!walletReady && <button className="manageButton" onClick={() => window.location.reload()}>Reintentar cartera</button>}
      {walletTransactions.some((item) => item.status === "transfer_review") && <p className="message" role="alert">Hay una transferencia con reembolso o cambio concurrente. Está bloqueada para conciliación; no se volverá a enviar. Puedes recuperar una transferencia con reembolso completo.</p>}
      {testConnect && walletTransactions.some(item => item.status === "transfer_review") && <button className="manageButton" disabled={requesting} onClick={recoverRefund}>{requesting ? "Procesando…" : "Recuperar transferencia reembolsada (prueba)"}</button>}

      <section className="bankCard">
        <div>
          <p className="eyebrow">Stripe Connect · Solo pruebas</p>
          <h2>{connect?.ready ? "Cuenta Stripe lista" : connect?.connected ? "Completa el registro en Stripe" : "Conecta tu cuenta del conductor"}</h2>
          <p>Registra tus datos directamente en Stripe. RoadLink no pide números de cuenta bancaria.</p>
          <p>Una transferencia al saldo Stripe no equivale a un depósito en el banco.</p>
        </div>
        <button className="manageButton" disabled={!testConnect || requesting} onClick={() => connectAction("onboard")}>Conectar o completar Stripe</button>
        {connect?.ready && <button className="manageButton" disabled={requesting} onClick={() => connectAction("dashboard")}>Abrir panel de Stripe</button>}
      </section>

      <section className="stats">
        <Metric icon="💰" label="Gross Earnings" value={money(lifetimeGross)} />
        <Metric icon="🧾" label="RoadLink Fee" value={money(lifetimeFees)} />
        <Metric icon="🏦" label="Driver Net" value={money(lifetimeNetFromBookings)} />
        <Metric icon="✅" label="Available" value={money(availableBalance)} />
        <Metric icon="⏳" label="Pending Trips" value={money(pendingBalance)} />
        <Metric icon="📤" label="Requested" value={money(activePayoutRequests)} />
        <Metric icon="💸" label="Enviado a Stripe (pruebas)" value={money(walletTransactions.filter((item) => item.status === "transferred").reduce((sum, item) => sum + Number(item.amount || 0), 0))} />
        <Metric icon="🚗" label="Completed Trips" value={walletReady ? String(bookings.filter((item) => item.status === "completed").length) : "—"} />
      </section>

      <section className="payoutCard">
        <div>
          <p className="eyebrow">Payout Center</p>
          <h2>Transferir a Stripe de pruebas</h2>
          <p>Available to request: <strong>{money(availableBalance)}</strong></p>
          <p>Pending or approved payout requests are reserved and not counted as available money.</p>
        </div>

        <button onClick={requestPayout} disabled={!testConnect || !connect?.ready || !walletReady || requesting || !walletTransactions.some((item) => ["available", "transferring"].includes(item.status || ""))}>
          {requesting ? "Procesando…" : "Transferir o reintentar en Stripe"}
        </button>
      </section>

      <section className="history">
        <p className="eyebrow">Payout Requests</p>
        <h2>Request History</h2>

        {payouts.length === 0 ? (
          <div className="emptyCard">
            <h3>No payout requests yet</h3>
            <p>Your payout requests will appear here.</p>
          </div>
        ) : (
          payouts.map((payout) => (
            <div key={payout.id} className="transaction">
              <div className="transactionIcon">🏦</div>

              <div>
                <strong>{payout.status === "reversed" ? "Recuperado por reembolso (pruebas)" : payout.status === "transferred" ? "Enviado a Stripe (pruebas)" : payout.status === "paid" ? "Payout Sent" : "Transferencia pendiente o en revisión"}</strong>
                <p>{formatDate(payout.createdAt)}</p>
                <small>Status: {String(payout.status || "pending").toUpperCase()}</small>
              </div>

              <div className={`amount ${payout.status || "pending"}`}>
                {money(payout.amount)}
              </div>
            </div>
          ))
        )}
      </section>

      <section className="history">
        <p className="eyebrow">Wallet Transactions</p>
        <h2>Activity History</h2>

        {!walletReady ? (
          <div className="emptyCard" role="status">
            <h3>Historial sin verificar</h3>
            <p>Esperando la lectura del servidor. Esto no significa que tu historial esté vacío.</p>
          </div>
        ) : walletActivity.length === 0 ? (
          <div className="emptyCard">
            <h3>No wallet activity yet</h3>
            <p>Completed ride earnings, wallet transactions and payouts will appear here.</p>
          </div>
        ) : (
          walletActivity.map((activity) => (
            <div key={activity.id} className="transaction">
              <div className="transactionIcon">{activity.icon}</div>

              <div>
                <strong>{activity.title}</strong>
                <p>{activity.subtitle}</p>
                <small>
                  {activity.detail}
                  {activity.date ? ` • ${formatDate(activity.date)}` : ""}
                </small>
              </div>

              <div
                className={
                  activity.sign === "+"
                    ? "amount good"
                    : activity.sign === "-"
                    ? "amount paidOut"
                    : "amount pending"
                }
              >
                {activity.sign === "+" ? "+" : activity.sign === "-" ? "-" : ""}
                {money(activity.amount)}
              </div>
            </div>
          ))
        )}
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
          padding: 20px;
          padding-bottom: 120px;
          font-family: Arial, sans-serif;
        }

        .hero,
        .stats,
        .bankCard,
        .payoutCard,
        .history {
          max-width: 980px;
          margin-left: auto;
          margin-right: auto;
        }

        .hero,
        .metric,
        .bankCard,
        .payoutCard,
        .history,
        .transaction,
        .emptyCard {
          background: rgba(8, 13, 25, 0.92);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 24px 80px rgba(0,0,0,0.55);
          backdrop-filter: blur(16px);
        }

        .hero {
          border-radius: 34px;
          padding: 30px;
          margin-bottom: 18px;
        }

        .topNav {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 28px;
        }

        .miniButton {
          padding: 11px 16px;
          border-radius: 999px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
          text-decoration: none;
          font-weight: 900;
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
          font-size: 54px;
          line-height: 1;
          margin: 0 0 14px;
        }

        h1 span,
        h2,
        .balanceBox strong,
        .metricValue {
          color: #22c55e;
        }

        .subtitle {
          color: #a1a1aa;
          font-size: 18px;
          line-height: 1.5;
        }

        .balanceBox {
          margin-top: 24px;
          padding: 24px;
          border-radius: 26px;
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .balanceBox span,
        .balanceBox small {
          display: block;
          color: #a1a1aa;
          font-weight: 900;
        }

        .balanceBox strong {
          display: block;
          font-size: 54px;
          margin: 8px 0;
        }

        .message {
          max-width: 980px;
          margin: 0 auto 18px;
          color: #22c55e;
          font-weight: 900;
        }

        .bankCard {
          border-radius: 30px;
          padding: 26px;
          margin-bottom: 18px;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 18px;
          align-items: center;
        }

        .bankRows {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-top: 16px;
        }

        .bankInfo {
          padding: 14px;
          border-radius: 18px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .bankInfo span {
          display: block;
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 6px;
        }

        .bankInfo strong {
          overflow-wrap: anywhere;
        }

        .manageButton {
          padding: 16px 22px;
          border-radius: 999px;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          text-decoration: none;
          font-weight: 900;
          text-align: center;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-bottom: 18px;
        }

        .metric {
          border-radius: 24px;
          padding: 20px;
        }

        .metricIcon {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          margin-bottom: 14px;
        }

        .metricLabel {
          display: block;
          color: #a1a1aa;
          font-size: 13px;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .metricValue {
          font-size: 24px;
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .payoutCard,
        .history {
          border-radius: 30px;
          padding: 26px;
          margin-bottom: 18px;
        }

        .payoutCard {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 18px;
          align-items: center;
        }

        .payoutCard h2,
        .history h2 {
          margin: 0 0 10px;
          font-size: 30px;
        }

        .payoutCard p,
        .emptyCard p {
          color: #a1a1aa;
          line-height: 1.5;
        }

        .payoutCard strong {
          color: #22c55e;
        }

        .payoutCard button {
          padding: 16px 22px;
          border-radius: 999px;
          border: none;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          font-weight: 900;
          cursor: pointer;
        }

        .payoutCard button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .transaction {
          display: grid;
          grid-template-columns: 50px 1fr auto;
          gap: 14px;
          align-items: center;
          border-radius: 20px;
          padding: 16px;
          margin-top: 12px;
        }

        .transactionIcon {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }

        .transaction strong {
          display: block;
          margin-bottom: 5px;
        }

        .transaction p,
        .transaction small {
          color: #a1a1aa;
          margin: 0;
          overflow-wrap: anywhere;
        }

        .amount {
          font-size: 20px;
          font-weight: 900;
          white-space: nowrap;
        }

        .amount.good,
        .amount.approved {
          color: #22c55e;
        }

        .amount.pending {
          color: #fde68a;
        }

        .amount.rejected,
        .amount.paid,
        .amount.paidOut {
          color: #fca5a5;
        }

        .emptyCard {
          border-radius: 24px;
          padding: 24px;
        }

        @media (max-width: 900px) {
          .stats {
            grid-template-columns: repeat(2, 1fr);
          }

          .bankCard,
          .payoutCard {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .page {
            padding: 16px;
            padding-bottom: 120px;
          }

          .hero,
          .bankCard,
          .payoutCard,
          .history {
            padding: 24px;
            border-radius: 28px;
          }

          h1 {
            font-size: 44px;
          }

          .stats,
          .bankRows,
          .transaction {
            grid-template-columns: 1fr;
          }

          .balanceBox strong {
            font-size: 44px;
          }

          .amount {
            font-size: 24px;
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

function BankInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="bankInfo">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
