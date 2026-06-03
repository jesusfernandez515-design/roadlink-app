"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../../lib/firebase";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";

type Ride = {
  id: string;
  from: string;
  to: string;
  date: string;
  time: string;
  seats: number;
  price: number;
  vehicle: string;
  notes?: string;
  status: string;
  driverEmail: string;
  driverId?: string;
};

export default function FindRidePage() {
  const router = useRouter();

  const [rides, setRides] = useState<Ride[]>([]);
  const [reservedRideIds, setReservedRideIds] = useState<string[]>([]);
  const [message, setMessage] = useState("Loading rides...");
  const [loadingRideId, setLoadingRideId] = useState("");

  async function loadRides() {
    try {
      const q = query(collection(db, "rides"), where("status", "==", "active"));
      const snapshot = await getDocs(q);

      const ridesData = snapshot.docs.map((document) => ({
        id: document.id,
        ...document.data(),
      })) as Ride[];

      setRides(ridesData);
      setMessage(ridesData.length ? "" : "No rides available yet.");
    } catch (error: any) {
      setMessage(error.message);
    }
  }

  async function loadUserBookings() {
    const user = auth.currentUser;

    if (!user) {
      setReservedRideIds([]);
      return;
    }

    const q = query(
      collection(db, "bookings"),
      where("passengerId", "==", user.uid),
      where("status", "==", "reserved")
    );

    const snapshot = await getDocs(q);

    const ids = snapshot.docs
      .map((document) => document.data().rideId)
      .filter(Boolean);

    setReservedRideIds(ids);
  }

  async function reserveSeat(ride: Ride) {
    setMessage("");

    try {
      const user = auth.currentUser;

      if (!user) {
        setMessage("Please sign in before reserving a seat.");
        router.push("/login");
        return;
      }

      if (ride.driverId === user.uid) {
        setMessage("You cannot reserve your
