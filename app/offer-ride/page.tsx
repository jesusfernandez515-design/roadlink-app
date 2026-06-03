"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../../lib/firebase";
import { addDoc, collection } from "firebase/firestore";

export default function OfferRidePage() {
  const router = useRouter();

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [seats, setSeats] = useState("1");
  const [price, setPrice] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function publishRide() {
    setMessage("");

    const user = auth.currentUser;

    if (!user) {
      setMessage("Please sign in before publishing a ride.");
      router.push("/login");
      return;
    }

    if (!from || !to || !date || !time || !price || !vehicle) {
      setMessage("Please complete all required fields.");
      return;
    }

    if (Number(price) <= 0) {
      setMessage("Price must be greater than 0.");
      return;
    }

    if (Number(seats) <= 0) {
      setMessage("Seats must be greater than 0.");
      return;
    }

    try {
      setLoading(true);

      await addDoc(collection(db, "rides"), {
        driverId: user.uid,
        driverEmail: user.email || "",
        from: from.trim(),
        to: to.trim(),
        date,
        time,
        seats: Number(seats),
        originalSeats: Number(seats),
        price: Number(price),
        vehicle: vehicle.trim(),
        notes: notes.trim(),
        status: "active",
        createdAt: new Date().toISOString(),
      });

      setMessage("Ride published successfully.");

      setFrom("");
      setTo("");
      setDate("");
      setTime("");
      setSeats("1");
      setPrice("");
      setVehicle("");
      setNotes("");

      setTimeout(() => {
        router.push("/find-ride");
      }, 800);
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <section className="card">
        <div className="logo">
          Road<span>Link</span>
        </div>

        <h1>Offer a Ride</h1>
        <p className="subtitle">
          Publish your route and let passengers join your trip.
        </p>

        <label>From *</label>
        <input
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          placeholder="City or address"
        />

        <label>To *</label>
        <input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="City or address"
        />

        <label>Date *</label>
        <input
          value={date}
          onChange={(e) => setDate(e.target.value)}
          type="date"
        />
