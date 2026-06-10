"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  where,
} from "firebase/firestore";

type UserProfile = {
  name?: string;
  email?: string;
  photoURL?: string;
  city?: string;
  state?: string;
  emailVerified?: boolean;
  verified?: boolean;
  driverVerified?: boolean;
  licenseVerified?: boolean;
  phoneVerified?: boolean;
  verificationStatus?: string;
};

type Ride = {
  id: string;
  from?: string;
  to?: string;
  date?: string;
  time?: string;
  price?: number;
  status?: string;
  createdAt?: string;
};

type Booking = {
  id: string;
  from?: string;
  to?: string;
  date?: string;
  time?: string;
  price?: number;
  driverEmail?: string;
  passengerId?: string;
  passengerEmail?: string;
  status?: string;
  seatsBooked?: number;
  createdAt?: string;
};

type Chat = {
  id: string;
  chatId?: string;
  driverId?: string;
  passengerId?: string;
  unreadCount?: number;
};

type NotificationItem = {
  id: string;
  title?: string;
  message?: string;
  type?: string;
  read?: boolean;
  createdAt?: any;
  actionUrl?: string;
};

export default function DashboardPage() {
  const [profile, setProfile] = useState<UserProfile>({});
  const [avatar, setAvatar] = useState("R");
  const [rides, setRides] = useState<Ride[]>([]);
  const [passengerBookings, setPassengerBookings] = useState<Booking[]>([]);
  const [driverBookings, setDriverBookings] = useState<Booking[]>([]);
  const [driverChats, setDriverChats] = useState<Chat[]>([]);
  const [passengerChats, setPassengerChats] = useState<Chat[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [message, setMessage] = useState("Loading dashboard...");

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;
    let unsubscribeRides: (() => void) | undefined;
    let unsubscribePassengerBookings: (() => void) | undefined;
    let unsubscribeDriverBookings: (() => void) | undefined;
    let unsubscribeDriverChats: (() => void) | undefined;
    let unsubscribePassengerChats: (() => void) | undefined;
    let unsubscribeNotifications: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setProfile({});
        setAvatar("R");
        setRides([]);
        setPassengerBookings([]);
        setDriverBookings([]);
        setDriverChats([]);
        setPassengerChats([]);
        setNotifications([]);
        setMessage("Please sign in to view your dashboard.");
        return;
      }

      const userEmail = user.email || "";
      const fallbackName = user.displayName || "RoadLink User";
      const fallbackPhoto = user.photoURL || "";

      setAvatar(userEmail ? userEmail.charAt(0).toUpperCase() : "R");
      setMessage("");

      const userRef = doc(db, "users", user.uid);

      try {
        const existingUser = await getDoc(userRef);

        if (!existingUser.exists()) {
          await setDoc(
            userRef,
            {
              name: fallbackName,
              email: userEmail,
              photoURL: fallbackPhoto,
              role: "member",
              emailVerified: Boolean(user.emailVerified),
              verified: false,
              phoneVerified: false,
              driverVerified: false,
              licenseVerified: false,
              verificationStatus: "not_submitted",
              city: "",
              state: "",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        } else {
          await setDoc(
            userRef,
            {
              email: userEmail,
              emailVerified: Boolean(user.emailVerified),
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        }
      } catch (error: unknown) {
        setMessage(error instanceof Error ? error.message : "Something went wrong.");
      }

      unsubscribeProfile = onSnapshot(userRef, (snapshot) => {
        const data = snapshot.data() as UserProfile | undefined;

        setProfile({
          name: data?.name || fallbackName,
          email: data?.email || userEmail,
          photoURL: data?.photoURL || fallbackPhoto,
          city: data?.city || "",
          state: data?.state || "",
          emailVerified: Boolean(user.emailVerified || data?.emailVerified),
          verified: Boolean(data?.verified),
          driverVerified: Boolean(data?.driverVerified),
          licenseVerified: Boolean(data?.licenseVerified),
          phoneVerified: Boolean(data?.phoneVerified),
          verificationStatus: data?.verificationStatus || "not_submitted",
        });
      });

      unsubscribeRides = onSnapshot(
        query(collection(db, "rides"), where("driverId", "==", user.uid)),
        (snapshot) => {
          const data = snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          })) as Ride[];

          data.sort((a, b) =>
            String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
          );

          setRides(data);
        },
        (error) => setMessage(error.message)
      );

      unsubscribePassengerBookings = onSnapshot(
        query(collection(db, "bookings"), where("passengerId", "==", user.uid)),
        (snapshot) => {
          const data = snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          })) as Booking[];

          data.sort((a, b) =>
            String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
          );

          setPassengerBookings(data);
        },
        (error) => setMessage(error.message)
      );

      unsubscribeDriverBookings = onSnapshot(
        query(collection(db, "bookings"), where("driverId", "==", user.uid)),
        (snapshot) => {
          const data = snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          })) as Booking[];

          data.sort((a, b) =>
            String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
          );

          setDriverBookings(data);
        },
        (error) => setMessage(error.message)
      );

      unsubscribeDriverChats = onSnapshot(
        query(collection(db, "chats"), where("driverId", "==", user.uid)),
        (snapshot) => {
          setDriverChats(
            snapshot.docs.map((document) => ({
              id: document.id,
              ...document.data(),
            })) as Chat[]
          );
        },
        (error) => setMessage(error.message)
      );

      unsubscribePassengerChats = onSnapshot(
        query(collection(db, "chats"), where("passengerId", "==", user.uid)),
        (snapshot) => {
          setPassengerChats(
            snapshot.docs.map((document) => ({
              id: document.id,
              ...document.data(),
            })) as Chat[]
          );
        },
        (error) => setMessage(error.message)
      );

      unsubscribeNotifications = onSnapshot(
        query(collection(db, "notifications"), where("userId", "==", user.uid)),
        (snapshot) => {
          const data = snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          })) as NotificationItem[];

          data.sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt));
          setNotifications(data);
        },
        (error) => setMessage(error.message)
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeRides) unsubscribeRides();
      if (unsubscribePassengerBookings) unsubscribePassengerBookings();
      if (unsubscribeDriverBookings) unsubscribeDriverBookings();
      if (unsubscribeDriverChats) unsubscribeDriverChats();
      if (unsubscribePassengerChats) unsubscribePassengerChats();
      if (unsubscribeNotifications) unsubscribeNotifications();
    };
  }, []);

  function getTime(value?: any) {
    try {
      const date = value?.toDate ? value.toDate() : new Date(value || "");
      return Number.isNaN(date.getTime()) ? 0 : date.getTime();
    } catch {
      return 0;
    }
  }

  function formatTime(value?: any) {
    if (!value) return "Recently";

    try {
      const date = value?.toDate ? value.toDate() : new Date(value);
      if (Number.isNaN(date.getTime())) return "Recently";

      return date.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Recently";
    }
  }

  function getActivityIcon(type?: string) {
    if (type === "message") return "💬";
    if (type === "booking") return "🎟️";
    if (type === "ride") return "🚘";
    if (type === "review") return "⭐";
    if (type === "payment" || type === "payout") return "💵";
    return "🔔";
  }

  const chats = useMemo(() => {
    const map = new Map<string, Chat>();

    [...driverChats, ...passengerChats].forEach((chat) => {
      const key = chat.chatId || chat.id;

      if (!key) return;
      if (key === "chat_abc123") return;
      if (chat.driverId === "test-driver") return;
      if (chat.passengerId === "test-passenger") return;

      map.set(key, chat);
    });

    return Array.from(map.values());
  }, [driverChats, passengerChats]);

  const activeRides = rides.filter(
    (ride) => ride.status === "active" || ride.status === "full"
  );

  const completedRides = rides.filter((ride) => ride.status === "completed");

  const activePassengerBookings = passengerBookings.filter(
    (booking) => booking.status === "reserved"
  );

  const activeDriverBookings = driverBookings.filter(
    (booking) => booking.status === "reserved"
  );

  const unreadMessages = chats.reduce(
    (total, chat) => total + Number(chat.unreadCount || 0),
    0
  );

  const unreadNotifications = notifications.filter((item) => !item.read).length;

  const earnings = driverBookings
    .filter((booking) => booking.status === "reserved" || booking.status === "completed")
    .reduce(
      (total, booking) =>
        total + Number(booking.price || 0) * Number(booking.seatsBooked || 1),
      0
    );

  const passengersTransported = driverBookings
    .filter((booking) => booking.status === "reserved" || booking.status === "completed")
    .reduce((total, booking) => total + Number(booking.seatsBooked || 1), 0);

  const driverVerified =
    profile.driverVerified === true ||
    profile.verified === true ||
    profile.verificationStatus === "approved";

  const trustScore = Math.min(
    100,
    40 +
      (profile.emailVerified ? 15 : 0) +
      (profile.phoneVerified ? 15 : 0) +
      (driverVerified ? 25 : 0) +
      (profile.licenseVerified ? 5 : 0)
  );

  const trustLabel =
    trustScore >= 85 ? "Premium Driver" : trustScore >= 65 ? "Trusted Driver" : "Basic Account";

  const upcomingTrip = activePassengerBookings[0];
  const recentActivity = notifications.slice(0, 3);

  const displayName = profile.name || "RoadLink User";
  const displayEmail = profile.email || "No email found";
  const displayPhoto = profile.photoURL || "";
  const locationText =
    profile.city || profile.state
      ? `${profile.city || ""}${profile.city && profile.state ? ", " : ""}${profile.state || ""}`
      : "Location not set";
  "use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  where,
} from "firebase/firestore";

type UserProfile = {
  name?: string;
  email?: string;
  photoURL?: string;
  city?: string;
  state?: string;
  emailVerified?: boolean;
  verified?: boolean;
  driverVerified?: boolean;
  licenseVerified?: boolean;
  phoneVerified?: boolean;
  verificationStatus?: string;
};

type Ride = {
  id: string;
  from?: string;
  to?: string;
  date?: string;
  time?: string;
  price?: number;
  status?: string;
  createdAt?: string;
};

type Booking = {
  id: string;
  from?: string;
  to?: string;
  date?: string;
  time?: string;
  price?: number;
  driverEmail?: string;
  passengerId?: string;
  passengerEmail?: string;
  status?: string;
  seatsBooked?: number;
  createdAt?: string;
};

type Chat = {
  id: string;
  chatId?: string;
  driverId?: string;
  passengerId?: string;
  unreadCount?: number;
};

type NotificationItem = {
  id: string;
  title?: string;
  message?: string;
  type?: string;
  read?: boolean;
  createdAt?: any;
  actionUrl?: string;
};

export default function DashboardPage() {
  const [profile, setProfile] = useState<UserProfile>({});
  const [avatar, setAvatar] = useState("R");
  const [rides, setRides] = useState<Ride[]>([]);
  const [passengerBookings, setPassengerBookings] = useState<Booking[]>([]);
  const [driverBookings, setDriverBookings] = useState<Booking[]>([]);
  const [driverChats, setDriverChats] = useState<Chat[]>([]);
  const [passengerChats, setPassengerChats] = useState<Chat[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [message, setMessage] = useState("Loading dashboard...");

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;
    let unsubscribeRides: (() => void) | undefined;
    let unsubscribePassengerBookings: (() => void) | undefined;
    let unsubscribeDriverBookings: (() => void) | undefined;
    let unsubscribeDriverChats: (() => void) | undefined;
    let unsubscribePassengerChats: (() => void) | undefined;
    let unsubscribeNotifications: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setProfile({});
        setAvatar("R");
        setRides([]);
        setPassengerBookings([]);
        setDriverBookings([]);
        setDriverChats([]);
        setPassengerChats([]);
        setNotifications([]);
        setMessage("Please sign in to view your dashboard.");
        return;
      }

      const userEmail = user.email || "";
      const fallbackName = user.displayName || "RoadLink User";
      const fallbackPhoto = user.photoURL || "";

      setAvatar(userEmail ? userEmail.charAt(0).toUpperCase() : "R");
      setMessage("");

      const userRef = doc(db, "users", user.uid);

      try {
        const existingUser = await getDoc(userRef);

        if (!existingUser.exists()) {
          await setDoc(
            userRef,
            {
              name: fallbackName,
              email: userEmail,
              photoURL: fallbackPhoto,
              role: "member",
              emailVerified: Boolean(user.emailVerified),
              verified: false,
              phoneVerified: false,
              driverVerified: false,
              licenseVerified: false,
              verificationStatus: "not_submitted",
              city: "",
              state: "",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        } else {
          await setDoc(
            userRef,
            {
              email: userEmail,
              emailVerified: Boolean(user.emailVerified),
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        }
      } catch (error: unknown) {
        setMessage(error instanceof Error ? error.message : "Something went wrong.");
      }

      unsubscribeProfile = onSnapshot(userRef, (snapshot) => {
        const data = snapshot.data() as UserProfile | undefined;

        setProfile({
          name: data?.name || fallbackName,
          email: data?.email || userEmail,
          photoURL: data?.photoURL || fallbackPhoto,
          city: data?.city || "",
          state: data?.state || "",
          emailVerified: Boolean(user.emailVerified || data?.emailVerified),
          verified: Boolean(data?.verified),
          driverVerified: Boolean(data?.driverVerified),
          licenseVerified: Boolean(data?.licenseVerified),
          phoneVerified: Boolean(data?.phoneVerified),
          verificationStatus: data?.verificationStatus || "not_submitted",
        });
      });

      unsubscribeRides = onSnapshot(
        query(collection(db, "rides"), where("driverId", "==", user.uid)),
        (snapshot) => {
          const data = snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          })) as Ride[];

          data.sort((a, b) =>
            String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
          );

          setRides(data);
        },
        (error) => setMessage(error.message)
      );

      unsubscribePassengerBookings = onSnapshot(
        query(collection(db, "bookings"), where("passengerId", "==", user.uid)),
        (snapshot) => {
          const data = snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          })) as Booking[];

          data.sort((a, b) =>
            String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
          );

          setPassengerBookings(data);
        },
        (error) => setMessage(error.message)
      );

      unsubscribeDriverBookings = onSnapshot(
        query(collection(db, "bookings"), where("driverId", "==", user.uid)),
        (snapshot) => {
          const data = snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          })) as Booking[];

          data.sort((a, b) =>
            String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
          );

          setDriverBookings(data);
        },
        (error) => setMessage(error.message)
      );

      unsubscribeDriverChats = onSnapshot(
        query(collection(db, "chats"), where("driverId", "==", user.uid)),
        (snapshot) => {
          setDriverChats(
            snapshot.docs.map((document) => ({
              id: document.id,
              ...document.data(),
            })) as Chat[]
          );
        },
        (error) => setMessage(error.message)
      );

      unsubscribePassengerChats = onSnapshot(
        query(collection(db, "chats"), where("passengerId", "==", user.uid)),
        (snapshot) => {
          setPassengerChats(
            snapshot.docs.map((document) => ({
              id: document.id,
              ...document.data(),
            })) as Chat[]
          );
        },
        (error) => setMessage(error.message)
      );

      unsubscribeNotifications = onSnapshot(
        query(collection(db, "notifications"), where("userId", "==", user.uid)),
        (snapshot) => {
          const data = snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          })) as NotificationItem[];

          data.sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt));
          setNotifications(data);
        },
        (error) => setMessage(error.message)
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeRides) unsubscribeRides();
      if (unsubscribePassengerBookings) unsubscribePassengerBookings();
      if (unsubscribeDriverBookings) unsubscribeDriverBookings();
      if (unsubscribeDriverChats) unsubscribeDriverChats();
      if (unsubscribePassengerChats) unsubscribePassengerChats();
      if (unsubscribeNotifications) unsubscribeNotifications();
    };
  }, []);

  function getTime(value?: any) {
    try {
      const date = value?.toDate ? value.toDate() : new Date(value || "");
      return Number.isNaN(date.getTime()) ? 0 : date.getTime();
    } catch {
      return 0;
    }
  }

  function formatTime(value?: any) {
    if (!value) return "Recently";

    try {
      const date = value?.toDate ? value.toDate() : new Date(value);
      if (Number.isNaN(date.getTime())) return "Recently";

      return date.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Recently";
    }
  }

  function getActivityIcon(type?: string) {
    if (type === "message") return "💬";
    if (type === "booking") return "🎟️";
    if (type === "ride") return "🚘";
    if (type === "review") return "⭐";
    if (type === "payment" || type === "payout") return "💵";
    return "🔔";
  }

  const chats = useMemo(() => {
    const map = new Map<string, Chat>();

    [...driverChats, ...passengerChats].forEach((chat) => {
      const key = chat.chatId || chat.id;

      if (!key) return;
      if (key === "chat_abc123") return;
      if (chat.driverId === "test-driver") return;
      if (chat.passengerId === "test-passenger") return;

      map.set(key, chat);
    });

    return Array.from(map.values());
  }, [driverChats, passengerChats]);

  const activeRides = rides.filter(
    (ride) => ride.status === "active" || ride.status === "full"
  );

  const completedRides = rides.filter((ride) => ride.status === "completed");

  const activePassengerBookings = passengerBookings.filter(
    (booking) => booking.status === "reserved"
  );

  const activeDriverBookings = driverBookings.filter(
    (booking) => booking.status === "reserved"
  );

  const unreadMessages = chats.reduce(
    (total, chat) => total + Number(chat.unreadCount || 0),
    0
  );

  const unreadNotifications = notifications.filter((item) => !item.read).length;

  const earnings = driverBookings
    .filter((booking) => booking.status === "reserved" || booking.status === "completed")
    .reduce(
      (total, booking) =>
        total + Number(booking.price || 0) * Number(booking.seatsBooked || 1),
      0
    );

  const passengersTransported = driverBookings
    .filter((booking) => booking.status === "reserved" || booking.status === "completed")
    .reduce((total, booking) => total + Number(booking.seatsBooked || 1), 0);

  const driverVerified =
    profile.driverVerified === true ||
    profile.verified === true ||
    profile.verificationStatus === "approved";

  const trustScore = Math.min(
    100,
    40 +
      (profile.emailVerified ? 15 : 0) +
      (profile.phoneVerified ? 15 : 0) +
      (driverVerified ? 25 : 0) +
      (profile.licenseVerified ? 5 : 0)
  );

  const trustLabel =
    trustScore >= 85 ? "Premium Driver" : trustScore >= 65 ? "Trusted Driver" : "Basic Account";

  const upcomingTrip = activePassengerBookings[0];
  const recentActivity = notifications.slice(0, 3);

  const displayName = profile.name || "RoadLink User";
  const displayEmail = profile.email || "No email found";
  const displayPhoto = profile.photoURL || "";
  const locationText =
    profile.city || profile.state
      ? `${profile.city || ""}${profile.city && profile.state ? ", " : ""}${profile.state || ""}`
      : "Location not set";
