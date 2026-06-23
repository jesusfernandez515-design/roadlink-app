import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../../../lib/firebase";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.getroadlink.com";

if (!stripeSecretKey) {
  throw new Error("Missing STRIPE_SECRET_KEY environment variable.");
}

const stripe = new Stripe(stripeSecretKey);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const bookingId = String(body.bookingId || "").trim();
    const userId = String(body.userId || "").trim();
    const userEmail = String(body.userEmail || "").trim();

    if (!bookingId) {
      return NextResponse.json({ error: "bookingId is required." }, { status: 400 });
    }

    const bookingRef = doc(db, "bookings", bookingId);
    const bookingSnap = await getDoc(bookingRef);

    if (!bookingSnap.exists()) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    }

    const booking = bookingSnap.data();

    const seatsBooked = Math.max(Number(booking.seatsBooked || 1), 1);
    const baseAmount = Number(booking.amount || booking.price || 0);
    const amount = Math.round(baseAmount * seatsBooked * 100) / 100;

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Invalid booking amount." }, { status: 400 });
    }

    const platformFee = Math.round(amount * 0.12 * 100) / 100;
    const driverAmount = Math.max(Math.round((amount - platformFee) * 100) / 100, 0);
    const amountInCents = Math.round(amount * 100);

    const now = new Date().toISOString();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: userEmail || booking.passengerEmail || undefined,
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: amountInCents,
            product_data: {
              name: `RoadLink Ride: ${booking.from || "Origin"} to ${booking.to || "Destination"}`,
              description: `Booking ${bookingId}`,
            },
          },
        },
      ],
      metadata: {
        bookingId,
        rideId: String(booking.rideId || ""),
        passengerId: userId || String(booking.passengerId || ""),
        passengerEmail: userEmail || String(booking.passengerEmail || ""),
        driverId: String(booking.driverId || ""),
        driverEmail: String(booking.driverEmail || ""),
        amount: String(amount),
        platformFee: String(platformFee),
        driverAmount: String(driverAmount),
      },
      success_url: `${appUrl}/my-bookings?payment=success&bookingId=${bookingId}`,
      cancel_url: `${appUrl}/my-bookings?payment=cancelled&bookingId=${bookingId}`,
    });

    await setDoc(
      doc(db, "payments", `stripe-${session.id}`),
      {
        bookingId,
        rideId: String(booking.rideId || ""),
        passengerId: userId || String(booking.passengerId || ""),
        passengerEmail: userEmail || String(booking.passengerEmail || ""),
        driverId: String(booking.driverId || ""),
        driverEmail: String(booking.driverEmail || ""),
        amount,
        platformFee,
        driverAmount,
        seatsBooked,
        currency: "USD",
        provider: "stripe",
        status: "pending",
        type: "booking_payment",
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: "",
        checkoutUrl: session.url || "",
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    );

    await setDoc(
      bookingRef,
      {
        status: "payment_pending",
        paymentStatus: "pending",
        paymentId: `stripe-${session.id}`,
        stripeCheckoutSessionId: session.id,
        amount,
        platformFee,
        driverAmount,
        updatedAt: now,
      },
      { merge: true }
    );

    return NextResponse.json({
      url: session.url,
      sessionId: session.id,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not create Stripe Checkout session.",
      },
      { status: 500 }
    );
  }
}
