// UI eligibility mirrors Checkout's booking-state and Puerto Rico departure checks.
// The API still checks ownership, ride availability and payment amount.
export function canPayBooking(booking: { status?: string; paymentStatus?: string; date?: string; time?: string }, now = Date.now()) {
  if (!["reserved", "payment_pending"].includes(booking.status || "") ||
      !["unpaid", "pending"].includes(booking.paymentStatus || "")) return false;
  const departure = new Date(`${booking.date}T${booking.time}-04:00`).getTime();
  return Number.isFinite(departure) && departure > now;
}
