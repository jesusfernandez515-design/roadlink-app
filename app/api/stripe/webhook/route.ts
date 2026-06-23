import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../../../lib/firebase";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!stripeSecretKey) {
  throw new Error("Missing STRIPE_SECRET_KEY environment variable.");
}

const stripe = new Stripe(stripeSecretKey);

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Missing STRIPE_WEBHOOK_SECRET environment variable." },
      { status: 500 }
    );
  }

  if (!signature) {
    return NextResponse.json(
      { error: "Missing Stripe signature." },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Webhook signature verification failed: ${error.message}`
            : "Webhook signature verification failed.",
      },
      { status: 400 }
    );
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const bookingId = String(session.metadata?.bookingId || "");
      const rideId = String(session.metadata?.rideId || "");
      const passengerId = String(session.metadata?.passengerId || "");
      const passengerEmail = String(session.metadata?.passengerEmail || session.customer_email || "");
      const driverId = String(session.metadata?.driverId || "");
      const driverEmail = String(session.metadata?.driverEmail || "");
      const amount = Number(session.metadata?.amount || Number(session.amount_total || 0) / 100);
      const platformFee = Number(session.metadata?.platformFee || Math.round(amount * 0.12 * 100) / 100);
      const driverAmount = Number(session.metadata?.driverAmount || Math.max(amount - platformFee, 0));
      const paymentId = `stripe-${session.id}`;
      const now = new Date().toISOString();

      await setDoc(
        doc(db, "payments", paymentId),
        {
          bookingId,
          rideId,
          passengerId,
          passengerEmail,
          driverId,
          driverEmail,
          amount,
          platformFee,
          driverAmount,
          currency: String(session.currency || "usd").toUpperCase(),
          provider: "stripe",
          status: "paid",
          type: "booking_payment",
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: String(session.payment_intent || ""),
          paidAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

      if (bookingId) {
        await setDoc(
          doc(db, "bookings", bookingId),
          {
            status: "paid",
            paymentStatus: "paid",
            paymentId,
            stripeCheckoutSessionId: session.id,
            stripePaymentIntentId: String(session.payment_intent || ""),
            amount,
            platformFee,
            driverAmount,
            paidAt: now,
            updatedAt: now,
          },
          { merge: true }
        );
      }

      if (driverId || driverEmail) {
        await setDoc(
          doc(db, "walletTransactions", `wallet-${paymentId}`),
          {
            paymentId,
            bookingId,
            rideId,
            driverId,
            driverEmail,
            passengerId,
            passengerEmail,
            amount: driverAmount,
            platformFee,
            grossAmount: amount,
            type: "ride_payment",
            status: "pending_payout",
            description: "Stripe ride payment",
            createdAt: now,
            updatedAt: now,
          },
          { merge: true }
        );

        await setDoc(
          doc(db, "notifications", `payment-driver-${paymentId}`),
          {
            userId: driverId,
            email: driverEmail,
            title: "Booking paid",
            message: `A passenger paid $${Math.round(amount).toLocaleString()}. Driver earnings were added to wallet.`,
            type: "payment",
            read: false,
            bookingId,
            rideId,
            createdAt: now,
          },
          { merge: true }
        );
      }

      if (passengerId || passengerEmail) {
        await setDoc(
          doc(db, "notifications", `payment-passenger-${paymentId}`),
          {
            userId: passengerId,
            email: passengerEmail,
            title: "Payment successful",
            message: "Your RoadLink booking payment was completed successfully.",
            type: "payment",
            read: false,
            bookingId,
            rideId,
            createdAt: now,
          },
          { merge: true }
        );
      }

      await setDoc(
        doc(db, "auditLogs", `stripe-checkout-${session.id}`),
        {
          action: "Stripe Checkout Completed",
          targetId: paymentId,
          targetType: "payment",
          details: `Stripe payment completed for booking ${bookingId}`,
          severity: "success",
          createdAt: now,
        },
        { merge: true }
      );
    }

    if (event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const now = new Date().toISOString();

      await setDoc(
        doc(db, "auditLogs", `stripe-failed-${paymentIntent.id}`),
        {
          action: "Stripe Payment Failed",
          targetId: paymentIntent.id,
          targetType: "paymentIntent",
          details: paymentIntent.last_payment_error?.message || "Stripe payment failed.",
          severity: "warning",
          createdAt: now,
        },
        { merge: true }
      );
    }

    if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      const now = new Date().toISOString();

      await setDoc(
        doc(db, "auditLogs", `stripe-refund-${charge.id}`),
        {
          action: "Stripe Charge Refunded",
          targetId: charge.id,
          targetType: "charge",
          details: `Refund processed for charge ${charge.id}`,
          severity: "warning",
          createdAt: now,
        },
        { merge: true }
      );
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Webhook handler failed.",
      },
      { status: 500 }
    );
  }
}
