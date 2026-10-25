// Amounts here describe recorded payments, not promised booking revenue.
export function isPendingBooking(item: { status?: string; paymentStatus?: string }) {
  if (["cancelled", "canceled", "rejected", "completed", "paid"].includes(item.status || "")) return false;
  if (["paid", "refunded", "partially_refunded", "failed"].includes(item.paymentStatus || "")) return false;
  return ["reserved", "confirmed", "payment_pending"].includes(item.status || "");
}

export function retainedPayment(item: {
  type?: string; status?: string; amount?: number;
  grossAmount?: number; platformFee?: number; refundedCents?: number;
}) {
  if (item.type !== "ride_payment" || !["pending_payout", "available", "paid", "transferring", "transferred", "transfer_review"].includes(item.status || "")) {
    return { gross: 0, fee: 0, net: 0 };
  }
  const cents = (value: number | undefined) => Math.max(0, Math.round(Number(value || 0) * 100));
  const original = cents(item.grossAmount);
  const gross = Math.max(0, original - Math.max(0, Number(item.refundedCents || 0)));
  const net = Math.min(gross, cents(item.amount));
  return { gross: gross / 100, fee: (gross - net) / 100, net: net / 100 };
}
