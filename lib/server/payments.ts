import Stripe from "stripe";
import { ApiError } from "./firebase-admin";

export function paymentConfig() {
  const test = process.env.NEXT_PUBLIC_ROADLINK_ENV === "test";
  const key = test ? process.env.STRIPE_TEST_SECRET_KEY : process.env.STRIPE_SECRET_KEY;
  const webhook = test ? process.env.STRIPE_TEST_WEBHOOK_SECRET : process.env.STRIPE_WEBHOOK_SECRET;
  if (!key || (test && !key.startsWith("sk_test_")) || (!test && !key.startsWith("sk_live_"))) {
    throw new ApiError(503, "Payments are not configured for this environment.");
  }
  return { stripe: new Stripe(key), webhook, test };
}

export function bookingAmount(booking: Record<string, unknown>) {
  const seats = Number(booking.seatsBooked);
  const unit = Number(booking.price);
  if (!Number.isInteger(seats) || seats < 1 || seats > 6 || !Number.isFinite(unit) || unit <= 0) {
    throw new ApiError(409, "The booking has an invalid price or seat count.");
  }
  const cents = Math.round(unit * 100) * seats;
  if (!Number.isSafeInteger(cents) || cents < 50 || cents > 100000) {
    throw new ApiError(409, "The booking amount is outside the supported range.");
  }
  const feeCents = Math.round(cents * 0.12);
  return { cents, amount: cents / 100, platformFee: feeCents / 100, driverAmount: (cents - feeCents) / 100 };
}
