"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Gauge,
  Loader2,
  Map,
  MapPin,
  Minus,
  Percent,
  RefreshCcw,
  Route,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  TrendingUp,
  UsersRound,
  WalletCards,
  XCircle,
  Zap,
} from "lucide-react";
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "../../../lib/firebase";

type TimestampObject = {
  seconds?: number;
  nanoseconds?: number;
  toDate?: () => Date;
};

type TimestampLike =
  | TimestampObject
  | string
  | number
  | Date
  | null
  | undefined;

type RideItem = {
  id: string;
  from?: string;
  to?: string;
  origin?: string;
  destination?: string;
  status?: string;
  price?: number;
  distance?: number;
  distanceMiles?: number;
  duration?: number;
  durationMinutes?: number;
  seats?: number;
  availableSeats?: number;
  driverId?: string;
  driverEmail?: string;
  createdAt?: TimestampLike;
  date?: TimestampLike;
  departureDate?: TimestampLike;
};

type BookingItem = {
  id: string;
  rideId?: string;
  status?: string;
  price?: number;
  amount?: number;
  seatsBooked?: number;
  passengerId?: string;
  passengerEmail?: string;
  driverId?: string;
  driverEmail?: string;
  createdAt?: TimestampLike;
};

type UserItem = {
  id: string;
  role?: string;
  status?: string;
  driverVerified?: boolean;
  verificationStatus?: string;
  createdAt?: TimestampLike;
};

type PricingRule = {
  id: string;
  enabled: boolean;
  baseFare: number;
  minimumFare: number;
  maximumFare: number;
  perMileRate: number;
  perMinuteRate: number;
  platformFeePercent: number;
  demandWeight: number;
  supplyWeight: number;
  bookingVelocityWeight: number;
  cancellationWeight: number;
  weekendMultiplier: number;
  nightMultiplier: number;
  rushHourMultiplier: number;
  minimumSurge: number;
  maximumSurge: number;
  autoApply: boolean;
  updatedAt?: TimestampLike;
  updatedBy?: string;
};

type RoutePricing = {
  id: string;
  routeKey: string;
  from: string;
  to: string;
  rides: number;
  activeRides: number;
  completedRides: number;
  cancelledRides: number;
  bookings: number;
  confirmedBookings: number;
  cancelledBookings: number;
  availableSeats: number;
  seatsBooked: number;
  averageCurrentPrice: number;
  averageDistanceMiles: number;
  averageDurationMinutes: number;
  demandScore: number;
  supplyScore: number;
  bookingVelocityScore: number;
  cancellationRiskScore: number;
  marketScore: number;
  surgeMultiplier: number;
  recommendedPrice: number;
  minimumRecommendedPrice: number;
  maximumRecommendedPrice: number;
  revenueOpportunity: number;
  confidence: number;
  status: "stable" | "watch" | "surge" | "critical";
  recommendation: string;
  lastCalculatedAt?: TimestampLike;
  createdAt?: TimestampLike;
  updatedAt?: TimestampLike;
  appliedPrice?: number;
  appliedAt?: TimestampLike;
  appliedBy?: string;
};

type PricingStatus =
  | "stable"
  | "watch"
  | "surge"
  | "critical";

type StatusFilter = "all" | PricingStatus;

const DEFAULT_RULES: PricingRule = {
  id: "main",
  enabled: true,
  baseFare: 3.5,
  minimumFare: 10,
  maximumFare: 250,
  perMileRate: 0.42,
  perMinuteRate: 0.08,
  platformFeePercent: 18,
  demandWeight: 32,
  supplyWeight: 24,
  bookingVelocityWeight: 24,
  cancellationWeight: 20,
  weekendMultiplier: 1.08,
  nightMultiplier: 1.12,
  rushHourMultiplier: 1.15,
  minimumSurge: 1,
  maximumSurge: 2.5,
  autoApply: false,
};

const COLLECTION_LIMIT = 2000;

const statusLabels: Record<PricingStatus, string> = {
  stable: "Stable",
  watch: "Watch",
  surge: "Surge",
  critical: "Critical",
};

const statusStyles: Record<PricingStatus, string> = {
  stable:
    "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  watch:
    "border-amber-500/25 bg-amber-500/10 text-amber-300",
  surge:
    "border-orange-500/25 bg-orange-500/10 text-orange-300",
  critical:
    "border-red-500/25 bg-red-500/10 text-red-300",
};

function safeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeString(value?: string | null) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function normalizeStatus(value?: string | null) {
  return normalizeString(value).replace(/\s+/g, "_");
}

function toDate(value: TimestampLike): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === "object") {
    if (typeof value.toDate === "function") {
      const date = value.toDate();
      return Number.isNaN(date.getTime()) ? null : date;
    }

    if (typeof value.seconds === "number") {
      const date = new Date(value.seconds * 1000);
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }

  return null;
}

function getTime(value: TimestampLike) {
  return toDate(value)?.getTime() ?? 0;
}

function formatDate(value: TimestampLike) {
  const date = toDate(value);

  if (!date) return "No date";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatRelative(value: TimestampLike) {
  const date = toDate(value);

  if (!date) return "Unknown";

  const difference = Date.now() - date.getTime();
  const minutes = Math.floor(difference / 60000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);

  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);

  if (days < 30) return `${days}d ago`;

  return formatDate(value);
}

function isWithinDays(value: TimestampLike, days: number) {
  const time = getTime(value);

  if (!time) return false;

  return time >= Date.now() - days * 24 * 60 * 60 * 1000;
}

function currency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function percentage(value: number) {
  return `${Math.round(value)}%`;
}

function getRouteName(ride: RideItem) {
  const from = String(ride.from || ride.origin || "Unknown origin").trim();
  const to = String(
    ride.to || ride.destination || "Unknown destination",
  ).trim();

  return {
    from,
    to,
    key: `${normalizeString(from)}__${normalizeString(to)}`,
  };
}

function getRideDistance(ride: RideItem) {
  return Math.max(
    safeNumber(ride.distanceMiles),
    safeNumber(ride.distance),
  );
}

function getRideDuration(ride: RideItem) {
  return Math.max(
    safeNumber(ride.durationMinutes),
    safeNumber(ride.duration),
  );
}

function resolvePricingStatus(
  surgeMultiplier: number,
  demandScore: number,
  supplyScore: number,
): PricingStatus {
  if (
    surgeMultiplier >= 2 ||
    (demandScore >= 85 && supplyScore <= 25)
  ) {
    return "critical";
  }

  if (
    surgeMultiplier >= 1.45 ||
    (demandScore >= 70 && supplyScore <= 40)
  ) {
    return "surge";
  }

  if (
    surgeMultiplier >= 1.15 ||
    demandScore >= 55 ||
    supplyScore <= 50
  ) {
    return "watch";
  }

  return "stable";
}

function createRoutePricingId(routeKey: string) {
  return routeKey
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

async function fetchCollection<T>(collectionName: string): Promise<T[]> {
  const snapshot = await getDocs(
    query(collection(db, collectionName), limit(COLLECTION_LIMIT)),
  );

  return snapshot.docs.map(
    (document) =>
      ({
        id: document.id,
        ...document.data(),
      }) as T,
  );
}

function calculatePricingEngine({
  rides,
  bookings,
  rules,
}: {
  rides: RideItem[];
  bookings: BookingItem[];
  rules: PricingRule;
}) {
  const routeGroups = new Map<string, RideItem[]>();

  for (const ride of rides) {
    const route = getRouteName(ride);

    routeGroups.set(route.key, [
      ...(routeGroups.get(route.key) ?? []),
      ride,
    ]);
  }

  const pricingResults: RoutePricing[] = [];

  for (const [routeKey, routeRides] of routeGroups.entries()) {
    const firstRide = routeRides[0];
    const route = getRouteName(firstRide);

    const rideIds = new Set(routeRides.map((ride) => ride.id));

    const routeBookings = bookings.filter(
      (booking) => booking.rideId && rideIds.has(booking.rideId),
    );

    const recentRides = routeRides.filter((ride) =>
      isWithinDays(ride.createdAt || ride.date || ride.departureDate, 30),
    );

    const recentBookings = routeBookings.filter((booking) =>
      isWithinDays(booking.createdAt, 30),
    );

    const bookingsLastSevenDays = routeBookings.filter((booking) =>
      isWithinDays(booking.createdAt, 7),
    );

    const bookingsLastTwentyFourHours = routeBookings.filter(
      (booking) => isWithinDays(booking.createdAt, 1),
    );

    const activeRides = routeRides.filter((ride) =>
      ["active", "open", "published", "available", "scheduled"].includes(
        normalizeStatus(ride.status),
      ),
    );

    const completedRides = routeRides.filter((ride) =>
      ["completed", "finished"].includes(
        normalizeStatus(ride.status),
      ),
    );

    const cancelledRides = routeRides.filter((ride) =>
      ["cancelled", "canceled", "failed"].includes(
        normalizeStatus(ride.status),
      ),
    );

    const confirmedBookings = routeBookings.filter((booking) =>
      [
        "confirmed",
        "completed",
        "reserved",
        "accepted",
      ].includes(normalizeStatus(booking.status)),
    );

    const cancelledBookings = routeBookings.filter((booking) =>
      [
        "cancelled",
        "canceled",
        "rejected",
        "failed",
        "no_show",
      ].includes(normalizeStatus(booking.status)),
    );

    const availableSeats = activeRides.reduce(
      (total, ride) =>
        total +
        Math.max(
          safeNumber(ride.availableSeats),
          safeNumber(ride.seats),
          0,
        ),
      0,
    );

    const seatsBooked = confirmedBookings.reduce(
      (total, booking) =>
        total + Math.max(safeNumber(booking.seatsBooked), 1),
      0,
    );

    const validPrices = routeRides
      .map((ride) => safeNumber(ride.price))
      .filter((price) => price > 0);

    const validDistances = routeRides
      .map(getRideDistance)
      .filter((distance) => distance > 0);

    const validDurations = routeRides
      .map(getRideDuration)
      .filter((duration) => duration > 0);

    const averageCurrentPrice =
      validPrices.length > 0
        ? validPrices.reduce((total, price) => total + price, 0) /
          validPrices.length
        : 0;

    const averageDistanceMiles =
      validDistances.length > 0
        ? validDistances.reduce(
            (total, distance) => total + distance,
            0,
          ) / validDistances.length
        : 0;

    const averageDurationMinutes =
      validDurations.length > 0
        ? validDurations.reduce(
            (total, duration) => total + duration,
            0,
          ) / validDurations.length
        : 0;

    const bookingDemandBase =
      recentBookings.length * 8 +
      confirmedBookings.length * 3 +
      bookingsLastSevenDays.length * 5 +
      bookingsLastTwentyFourHours.length * 10;

    const demandScore = clamp(
      bookingDemandBase +
        Math.min(seatsBooked * 3, 20) +
        Math.min(recentRides.length * 2, 10),
      0,
      100,
    );

    const supplyScore = clamp(
      activeRides.length * 15 +
        availableSeats * 5 -
        confirmedBookings.length * 2,
      0,
      100,
    );

    const bookingVelocityScore = clamp(
      bookingsLastTwentyFourHours.length * 22 +
        bookingsLastSevenDays.length * 6,
      0,
      100,
    );

    const totalCancellationEvents =
      cancelledRides.length + cancelledBookings.length;

    const totalMarketplaceEvents =
      routeRides.length + routeBookings.length;

    const cancellationRate =
      totalMarketplaceEvents > 0
        ? totalCancellationEvents / totalMarketplaceEvents
        : 0;

    const cancellationRiskScore = clamp(
      cancellationRate * 100,
      0,
      100,
    );

    const demandPressure =
      (demandScore / 100) * (rules.demandWeight / 100);

    const supplyPressure =
      ((100 - supplyScore) / 100) *
      (rules.supplyWeight / 100);

    const velocityPressure =
      (bookingVelocityScore / 100) *
      (rules.bookingVelocityWeight / 100);

    const cancellationPressure =
      (cancellationRiskScore / 100) *
      (rules.cancellationWeight / 100);

    const marketPressure =
      demandPressure +
      supplyPressure +
      velocityPressure +
      cancellationPressure;

    const marketScore = clamp(marketPressure * 100, 0, 100);

    const currentDate = new Date();
    const currentHour = currentDate.getHours();
    const currentDay = currentDate.getDay();

    const isWeekend = currentDay === 0 || currentDay === 6;
    const isNight = currentHour >= 21 || currentHour <= 5;
    const isRushHour =
      (currentHour >= 6 && currentHour <= 9) ||
      (currentHour >= 16 && currentHour <= 19);

    const timeMultiplier =
      (isWeekend ? rules.weekendMultiplier : 1) *
      (isNight ? rules.nightMultiplier : 1) *
      (isRushHour ? rules.rushHourMultiplier : 1);

    const rawSurge =
      rules.minimumSurge +
      marketPressure * Math.max(rules.maximumSurge - 1, 0);

    const surgeMultiplier = clamp(
      rawSurge * timeMultiplier,
      rules.minimumSurge,
      rules.maximumSurge,
    );

    const calculatedBasePrice =
      rules.baseFare +
      averageDistanceMiles * rules.perMileRate +
      averageDurationMinutes * rules.perMinuteRate;

    const fallbackBasePrice =
      averageCurrentPrice > 0
        ? averageCurrentPrice
        : Math.max(calculatedBasePrice, rules.minimumFare);

    const recommendedPrice = roundMoney(
      clamp(
        Math.max(calculatedBasePrice, fallbackBasePrice) *
          surgeMultiplier,
        rules.minimumFare,
        rules.maximumFare,
      ),
    );

    const minimumRecommendedPrice = roundMoney(
      clamp(
        recommendedPrice * 0.9,
        rules.minimumFare,
        rules.maximumFare,
      ),
    );

    const maximumRecommendedPrice = roundMoney(
      clamp(
        recommendedPrice * 1.12,
        rules.minimumFare,
        rules.maximumFare,
      ),
    );

    const priceDifference =
      recommendedPrice - averageCurrentPrice;

    const projectedBookings = Math.max(
      confirmedBookings.length,
      Math.round(demandScore / 12),
    );

    const revenueOpportunity = roundMoney(
      Math.max(priceDifference, 0) * projectedBookings,
    );

    const confidence = clamp(
      45 +
        Math.min(routeRides.length * 4, 20) +
        Math.min(routeBookings.length * 3, 25) +
        (averageDistanceMiles > 0 ? 5 : 0) +
        (averageDurationMinutes > 0 ? 5 : 0),
      0,
      99,
    );

    const status = resolvePricingStatus(
      surgeMultiplier,
      demandScore,
      supplyScore,
    );

    let recommendation =
      "Maintain the current pricing range and continue monitoring marketplace activity.";

    if (status === "critical") {
      recommendation =
        "Immediate pricing adjustment recommended. Demand is significantly exceeding available supply.";
    } else if (status === "surge") {
      recommendation =
        "Apply dynamic surge pricing and encourage additional drivers to publish rides on this route.";
    } else if (status === "watch") {
      recommendation =
        "Monitor booking velocity and supply. A moderate price adjustment may improve marketplace balance.";
    }

    pricingResults.push({
      id: createRoutePricingId(routeKey),
      routeKey,
      from: route.from,
      to: route.to,
      rides: routeRides.length,
      activeRides: activeRides.length,
      completedRides: completedRides.length,
      cancelledRides: cancelledRides.length,
      bookings: routeBookings.length,
      confirmedBookings: confirmedBookings.length,
      cancelledBookings: cancelledBookings.length,
      availableSeats,
      seatsBooked,
      averageCurrentPrice: roundMoney(averageCurrentPrice),
      averageDistanceMiles: Math.round(averageDistanceMiles * 10) / 10,
      averageDurationMinutes: Math.round(averageDurationMinutes),
      demandScore: Math.round(demandScore),
      supplyScore: Math.round(supplyScore),
      bookingVelocityScore: Math.round(bookingVelocityScore),
      cancellationRiskScore: Math.round(cancellationRiskScore),
      marketScore: Math.round(marketScore),
      surgeMultiplier: Math.round(surgeMultiplier * 100) / 100,
      recommendedPrice,
      minimumRecommendedPrice,
      maximumRecommendedPrice,
      revenueOpportunity,
      confidence: Math.round(confidence),
      status,
      recommendation,
    });
  }

  return pricingResults.sort((first, second) => {
    if (first.status === "critical" && second.status !== "critical") {
      return -1;
    }

    if (second.status === "critical" && first.status !== "critical") {
      return 1;
    }

    return second.marketScore - first.marketScore;
  });
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
  tone = "green",
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: ReactNode;
  tone?: "green" | "red" | "amber" | "cyan" | "purple";
}) {
  const toneStyles = {
    green:
      "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    red: "border-red-500/20 bg-red-500/10 text-red-300",
    amber:
      "border-amber-500/20 bg-amber-500/10 text-amber-300",
    cyan: "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
    purple:
      "border-violet-500/20 bg-violet-500/10 text-violet-300",
  };

  return (
    <article className="group relative overflow-hidden rounded-3xl border border-white/[0.07] bg-slate-950/55 p-5 shadow-2xl shadow-black/20 backdrop-blur-2xl transition duration-300 hover:-translate-y-1 hover:border-white/[0.12]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
            {title}
          </p>

          <p className="mt-3 truncate text-3xl font-black tracking-tight text-white">
            {value}
          </p>

          <p className="mt-2 text-sm text-slate-400">{subtitle}</p>
        </div>

        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${toneStyles[tone]}`}
        >
          {icon}
        </div>
      </div>
    </article>
  );
}

function ScoreBar({
  label,
  value,
  inverse = false,
}: {
  label: string;
  value: number;
  inverse?: boolean;
}) {
  const normalizedValue = clamp(value);

  const barClass = inverse
    ? normalizedValue <= 30
      ? "from-red-500 to-orange-400"
      : normalizedValue <= 60
        ? "from-amber-500 to-yellow-300"
        : "from-emerald-500 to-cyan-300"
    : normalizedValue >= 75
      ? "from-red-500 to-orange-400"
      : normalizedValue >= 50
        ? "from-amber-500 to-yellow-300"
        : "from-emerald-500 to-cyan-300";

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-slate-400">
          {label}
        </span>

        <span className="text-xs font-black text-white">
          {Math.round(normalizedValue)}
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${barClass}`}
          style={{ width: `${normalizedValue}%` }}
        />
      </div>
    </div>
  );
}

function ComparisonBadge({
  currentPrice,
  recommendedPrice,
}: {
  currentPrice: number;
  recommendedPrice: number;
}) {
  if (currentPrice <= 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-xs font-bold text-cyan-300">
        <Sparkles className="h-3.5 w-3.5" />
        New recommendation
      </span>
    );
  }

  const difference =
    ((recommendedPrice - currentPrice) / currentPrice) * 100;

  if (Math.abs(difference) < 1) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-slate-500/20 bg-slate-500/10 px-2.5 py-1 text-xs font-bold text-slate-300">
        <Minus className="h-3.5 w-3.5" />
        No change
      </span>
    );
  }

  if (difference > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-orange-500/20 bg-orange-500/10 px-2.5 py-1 text-xs font-bold text-orange-300">
        <ArrowUpRight className="h-3.5 w-3.5" />
        {Math.abs(difference).toFixed(1)}%
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-300">
      <ArrowDownRight className="h-3.5 w-3.5" />
      {Math.abs(difference).toFixed(1)}%
    </span>
  );
}

export default function AiPricingPage() {
  const [pricingRules, setPricingRules] =
    useState<PricingRule>(DEFAULT_RULES);

  const [routePricing, setRoutePricing] = useState<RoutePricing[]>([]);
  const [selectedRoute, setSelectedRoute] =
    useState<RoutePricing | null>(null);

  const [loading, setLoading] = useState(true);
  const [runningEngine, setRunningEngine] = useState(false);
  const [savingRules, setSavingRules] = useState(false);
  const [applyingRouteId, setApplyingRouteId] =
    useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("all");

  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [lastRunAt, setLastRunAt] = useState<Date | null>(null);

  useEffect(() => {
    const rulesReference = doc(db, "pricingRules", "main");

    const unsubscribeRules = onSnapshot(
      rulesReference,
      (snapshot) => {
        if (snapshot.exists()) {
          setPricingRules({
            ...DEFAULT_RULES,
            id: snapshot.id,
            ...snapshot.data(),
          } as PricingRule);
        } else {
          setPricingRules(DEFAULT_RULES);
        }
      },
      (error) => {
        console.error("Pricing rules listener failed:", error);
        setErrorMessage(
          "RoadLink could not load the pricing rules.",
        );
      },
    );

    const pricingQuery = query(
      collection(db, "routePricing"),
      orderBy("marketScore", "desc"),
      limit(500),
    );

    const unsubscribePricing = onSnapshot(
      pricingQuery,
      (snapshot) => {
        const items = snapshot.docs.map(
          (document) =>
            ({
              id: document.id,
              ...document.data(),
            }) as RoutePricing,
        );

        setRoutePricing(items);
        setLoading(false);
      },
      (error) => {
        console.error("Route pricing listener failed:", error);
        setErrorMessage(
          "RoadLink could not load the route pricing intelligence.",
        );
        setLoading(false);
      },
    );

    return () => {
      unsubscribeRules();
      unsubscribePricing();
    };
  }, []);

  const createAuditLog = useCallback(
    async ({
      action,
      description,
      entityId,
      metadata,
    }: {
      action: string;
      description: string;
      entityId?: string;
      metadata?: Record<string, unknown>;
    }) => {
      const auditReference = doc(collection(db, "auditLogs"));

      await setDoc(auditReference, {
        id: auditReference.id,
        module: "ai-pricing-engine",
        action,
        description,
        entityId: entityId ?? null,
        metadata: metadata ?? {},
        actorId: auth.currentUser?.uid || "system",
        actorEmail:
          auth.currentUser?.email ||
          "ai-pricing-engine@roadlink.system",
        createdAt: serverTimestamp(),
      });
    },
    [],
  );

  const createNotification = useCallback(
    async ({
      title,
      message: notificationMessage,
      severity,
      entityId,
    }: {
      title: string;
      message: string;
      severity: "low" | "medium" | "high" | "critical";
      entityId?: string;
    }) => {
      const notificationReference = doc(
        collection(db, "notifications"),
      );

      await setDoc(notificationReference, {
        id: notificationReference.id,
        title,
        message: notificationMessage,
        type: "pricing_alert",
        severity,
        audience: "admin",
        entityId: entityId ?? null,
        read: false,
        createdAt: serverTimestamp(),
        createdBy:
          auth.currentUser?.email || "ai-pricing-engine",
      });
    },
    [],
  );

  const savePricingRules = useCallback(async () => {
    setSavingRules(true);
    setErrorMessage("");
    setMessage("");

    try {
      const normalizedRules: PricingRule = {
        ...pricingRules,
        baseFare: Math.max(safeNumber(pricingRules.baseFare), 0),
        minimumFare: Math.max(
          safeNumber(pricingRules.minimumFare),
          0,
        ),
        maximumFare: Math.max(
          safeNumber(pricingRules.maximumFare),
          safeNumber(pricingRules.minimumFare),
        ),
        perMileRate: Math.max(
          safeNumber(pricingRules.perMileRate),
          0,
        ),
        perMinuteRate: Math.max(
          safeNumber(pricingRules.perMinuteRate),
          0,
        ),
        platformFeePercent: clamp(
          safeNumber(pricingRules.platformFeePercent),
          0,
          100,
        ),
        demandWeight: clamp(
          safeNumber(pricingRules.demandWeight),
          0,
          100,
        ),
        supplyWeight: clamp(
          safeNumber(pricingRules.supplyWeight),
          0,
          100,
        ),
        bookingVelocityWeight: clamp(
          safeNumber(pricingRules.bookingVelocityWeight),
          0,
          100,
        ),
        cancellationWeight: clamp(
          safeNumber(pricingRules.cancellationWeight),
          0,
          100,
        ),
        weekendMultiplier: clamp(
          safeNumber(pricingRules.weekendMultiplier),
          1,
          3,
        ),
        nightMultiplier: clamp(
          safeNumber(pricingRules.nightMultiplier),
          1,
          3,
        ),
        rushHourMultiplier: clamp(
          safeNumber(pricingRules.rushHourMultiplier),
          1,
          3,
        ),
        minimumSurge: clamp(
          safeNumber(pricingRules.minimumSurge),
          1,
          5,
        ),
        maximumSurge: clamp(
          safeNumber(pricingRules.maximumSurge),
          Math.max(safeNumber(pricingRules.minimumSurge), 1),
          5,
        ),
      };

      await setDoc(
        doc(db, "pricingRules", "main"),
        {
          ...normalizedRules,
          id: "main",
          updatedAt: serverTimestamp(),
          updatedBy:
            auth.currentUser?.email || "RoadLink Admin",
        },
        { merge: true },
      );

      await createAuditLog({
        action: "PRICING_RULES_UPDATED",
        description:
          "RoadLink AI Pricing Engine configuration was updated.",
        entityId: "pricingRules/main",
        metadata: {
          minimumFare: normalizedRules.minimumFare,
          maximumFare: normalizedRules.maximumFare,
          perMileRate: normalizedRules.perMileRate,
          maximumSurge: normalizedRules.maximumSurge,
          autoApply: normalizedRules.autoApply,
        },
      });

      setPricingRules(normalizedRules);
      setMessage("Pricing rules saved successfully.");
    } catch (error) {
      console.error("Failed to save pricing rules:", error);

      setErrorMessage(
        "RoadLink could not save the pricing configuration.",
      );
    } finally {
      setSavingRules(false);
    }
  }, [createAuditLog, pricingRules]);

  const runPricingEngine = useCallback(async () => {
    setRunningEngine(true);
    setErrorMessage("");
    setMessage("Loading marketplace pricing signals...");

    try {
      const [rides, bookings, users] = await Promise.all([
        fetchCollection<RideItem>("rides"),
        fetchCollection<BookingItem>("bookings"),
        fetchCollection<UserItem>("users"),
      ]);

      setMessage(
        "Calculating demand, supply and dynamic pricing recommendations...",
      );

      const results = calculatePricingEngine({
        rides,
        bookings,
        rules: pricingRules,
      });

      const chunks: RoutePricing[][] = [];

      for (let index = 0; index < results.length; index += 400) {
        chunks.push(results.slice(index, index + 400));
      }

      for (const chunk of chunks) {
        const batch = writeBatch(db);

        for (const result of chunk) {
          const pricingReference = doc(
            db,
            "routePricing",
            result.id,
          );

          batch.set(
            pricingReference,
            {
              ...result,
              id: result.id,
              lastCalculatedAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              createdAt: serverTimestamp(),
              createdBy: "ai-pricing-engine",
              pricingRuleVersion: "v1",
            },
            { merge: true },
          );
        }

        await batch.commit();
      }

      const criticalRoutes = results.filter(
        (result) => result.status === "critical",
      );

      const surgeRoutes = results.filter(
        (result) => result.status === "surge",
      );

      const totalRevenueOpportunity = results.reduce(
        (total, result) => total + result.revenueOpportunity,
        0,
      );

      const verifiedDrivers = users.filter(
        (user) =>
          user.driverVerified === true ||
          normalizeStatus(user.verificationStatus) === "approved",
      ).length;

      await setDoc(
        doc(db, "pricingEngineRuns", `run-${Date.now()}`),
        {
          routesAnalyzed: results.length,
          ridesAnalyzed: rides.length,
          bookingsAnalyzed: bookings.length,
          usersAnalyzed: users.length,
          verifiedDrivers,
          criticalRoutes: criticalRoutes.length,
          surgeRoutes: surgeRoutes.length,
          totalRevenueOpportunity,
          rules: pricingRules,
          createdAt: serverTimestamp(),
          createdBy:
            auth.currentUser?.email || "ai-pricing-engine",
        },
      );

      await createAuditLog({
        action: "AI_PRICING_ENGINE_COMPLETED",
        description: `AI Pricing Engine analyzed ${results.length} routes.`,
        metadata: {
          routesAnalyzed: results.length,
          ridesAnalyzed: rides.length,
          bookingsAnalyzed: bookings.length,
          criticalRoutes: criticalRoutes.length,
          surgeRoutes: surgeRoutes.length,
          totalRevenueOpportunity,
        },
      });

      if (criticalRoutes.length > 0) {
        await createNotification({
          title: "Critical pricing opportunities detected",
          message: `${criticalRoutes.length} route${
            criticalRoutes.length === 1 ? "" : "s"
          } show critical demand and supply imbalance.`,
          severity: "critical",
        });
      } else if (surgeRoutes.length > 0) {
        await createNotification({
          title: "Dynamic surge opportunities detected",
          message: `${surgeRoutes.length} route${
            surgeRoutes.length === 1 ? "" : "s"
          } may benefit from temporary surge pricing.`,
          severity: "high",
        });
      }

      setLastRunAt(new Date());

      setMessage(
        `${results.length} routes analyzed · ${surgeRoutes.length} surge opportunities · ${currency(
          totalRevenueOpportunity,
        )} projected opportunity`,
      );
    } catch (error) {
      console.error("AI Pricing Engine failed:", error);

      setErrorMessage(
        "The AI Pricing Engine could not complete the analysis. Verify Firestore permissions and marketplace data.",
      );

      setMessage("");
    } finally {
      setRunningEngine(false);
    }
  }, [
    createAuditLog,
    createNotification,
    pricingRules,
  ]);

  const applyRecommendedPrice = useCallback(
    async (routePricingItem: RoutePricing) => {
      setApplyingRouteId(routePricingItem.id);
      setErrorMessage("");
      setMessage("");

      try {
        await updateDoc(
          doc(db, "routePricing", routePricingItem.id),
          {
            appliedPrice: routePricingItem.recommendedPrice,
            appliedAt: serverTimestamp(),
            appliedBy:
              auth.currentUser?.email || "RoadLink Admin",
            status:
              routePricingItem.status === "critical"
                ? "surge"
                : routePricingItem.status,
            updatedAt: serverTimestamp(),
          },
        );

        const matchingRidesSnapshot = await getDocs(
          query(collection(db, "rides"), limit(COLLECTION_LIMIT)),
        );

        const matchingDocuments = matchingRidesSnapshot.docs.filter(
          (rideDocument) => {
            const ride = {
              id: rideDocument.id,
              ...rideDocument.data(),
            } as RideItem;

            return getRouteName(ride).key === routePricingItem.routeKey;
          },
        );

        const rideChunks: typeof matchingDocuments[] = [];

        for (
          let index = 0;
          index < matchingDocuments.length;
          index += 400
        ) {
          rideChunks.push(
            matchingDocuments.slice(index, index + 400),
          );
        }

        for (const chunk of rideChunks) {
          const batch = writeBatch(db);

          for (const rideDocument of chunk) {
            batch.update(rideDocument.ref, {
              recommendedPrice:
                routePricingItem.recommendedPrice,
              pricingStatus: routePricingItem.status,
              surgeMultiplier:
                routePricingItem.surgeMultiplier,
              pricingUpdatedAt: serverTimestamp(),
            });
          }

          await batch.commit();
        }

        await createAuditLog({
          action: "RECOMMENDED_PRICE_APPLIED",
          description: `Recommended price applied to ${routePricingItem.from} → ${routePricingItem.to}.`,
          entityId: routePricingItem.id,
          metadata: {
            routeKey: routePricingItem.routeKey,
            currentPrice:
              routePricingItem.averageCurrentPrice,
            recommendedPrice:
              routePricingItem.recommendedPrice,
            surgeMultiplier:
              routePricingItem.surgeMultiplier,
            ridesUpdated: matchingDocuments.length,
          },
        });

        setSelectedRoute((currentRoute) =>
          currentRoute?.id === routePricingItem.id
            ? {
                ...currentRoute,
                appliedPrice:
                  routePricingItem.recommendedPrice,
                appliedAt: new Date(),
                appliedBy:
                  auth.currentUser?.email ||
                  "RoadLink Admin",
              }
            : currentRoute,
        );

        setMessage(
          `${currency(
            routePricingItem.recommendedPrice,
          )} recommendation applied to ${matchingDocuments.length} ride${
            matchingDocuments.length === 1 ? "" : "s"
          }.`,
        );
      } catch (error) {
        console.error("Failed to apply recommended price:", error);

        setErrorMessage(
          "RoadLink could not apply this pricing recommendation.",
        );
      } finally {
        setApplyingRouteId(null);
      }
    },
    [createAuditLog],
  );

  const filteredRoutes = useMemo(() => {
    const normalizedSearch = normalizeString(searchTerm);

    return routePricing
      .filter((routeItem) => {
        const matchesSearch =
          !normalizedSearch ||
          normalizeString(
            `${routeItem.from} ${routeItem.to} ${routeItem.routeKey}`,
          ).includes(normalizedSearch);

        const matchesStatus =
          statusFilter === "all" ||
          routeItem.status === statusFilter;

        return matchesSearch && matchesStatus;
      })
      .sort(
        (first, second) =>
          second.marketScore - first.marketScore,
      );
  }, [routePricing, searchTerm, statusFilter]);

  const metrics = useMemo(() => {
    const criticalRoutes = routePricing.filter(
      (routeItem) => routeItem.status === "critical",
    ).length;

    const surgeRoutes = routePricing.filter(
      (routeItem) => routeItem.status === "surge",
    ).length;

    const averageRecommendedPrice =
      routePricing.length > 0
        ? routePricing.reduce(
            (total, routeItem) =>
              total + routeItem.recommendedPrice,
            0,
          ) / routePricing.length
        : 0;

    const averageSurge =
      routePricing.length > 0
        ? routePricing.reduce(
            (total, routeItem) =>
              total + routeItem.surgeMultiplier,
            0,
          ) / routePricing.length
        : 1;

    const totalRevenueOpportunity = routePricing.reduce(
      (total, routeItem) =>
        total + routeItem.revenueOpportunity,
      0,
    );

    const averageDemand =
      routePricing.length > 0
        ? routePricing.reduce(
            (total, routeItem) =>
              total + routeItem.demandScore,
            0,
          ) / routePricing.length
        : 0;

    const averageSupply =
      routePricing.length > 0
        ? routePricing.reduce(
            (total, routeItem) =>
              total + routeItem.supplyScore,
            0,
          ) / routePricing.length
        : 0;

    return {
      criticalRoutes,
      surgeRoutes,
      averageRecommendedPrice,
      averageSurge,
      totalRevenueOpportunity,
      averageDemand,
      averageSupply,
    };
  }, [routePricing]);

  const topOpportunityRoutes = useMemo(
    () =>
      [...routePricing]
        .sort(
          (first, second) =>
            second.revenueOpportunity -
            first.revenueOpportunity,
        )
        .slice(0, 6),
    [routePricing],
  );

  function updateRule<K extends keyof PricingRule>(
    key: K,
    value: PricingRule[K],
  ) {
    setPricingRules((currentRules) => ({
      ...currentRules,
      [key]: value,
    }));
  }

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-12%] top-[-14%] h-[34rem] w-[34rem] rounded-full bg-emerald-500/10 blur-[150px]" />
        <div className="absolute right-[-10%] top-[12%] h-[32rem] w-[32rem] rounded-full bg-cyan-500/[0.08] blur-[160px]" />
        <div className="absolute bottom-[-24%] left-[35%] h-[38rem] w-[38rem] rounded-full bg-violet-500/[0.07] blur-[180px]" />
      </div>

      <div className="relative mx-auto w-full max-w-[1800px] px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <Link
                href="/admin"
                className="transition hover:text-emerald-300"
              >
                Admin Console
              </Link>

              <span>/</span>

              <span className="text-slate-300">
                AI Pricing Engine
              </span>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 shadow-xl shadow-emerald-500/10">
                <BrainCircuit className="h-7 w-7 text-emerald-300" />
              </div>

              <div>
                <h1 className="text-2xl font-black tracking-tight sm:text-4xl">
                  AI Pricing Engine
                </h1>

                <p className="mt-1 max-w-3xl text-sm text-slate-400 sm:text-base">
                  Intelligent route pricing, demand analysis and
                  dynamic surge recommendations for the RoadLink
                  marketplace.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="rounded-2xl border border-white/[0.07] bg-slate-950/55 px-4 py-3 backdrop-blur-2xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Pricing Intelligence
              </p>

              <div className="mt-1 flex items-center gap-2 text-sm font-bold text-emerald-300">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </span>

                {pricingRules.enabled
                  ? "Engine enabled"
                  : "Engine paused"}
              </div>
            </div>

            <button
              type="button"
              onClick={runPricingEngine}
              disabled={runningEngine || !pricingRules.enabled}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-slate-950 shadow-xl shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {runningEngine ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Sparkles className="h-5 w-5" />
              )}

              {runningEngine
                ? "Calculating Prices"
                : "Run Pricing Engine"}
            </button>
          </div>
        </header>

        {(message || errorMessage) && (
          <div
            className={`mb-6 flex items-start gap-3 rounded-2xl border p-4 ${
              errorMessage
                ? "border-red-500/20 bg-red-500/10 text-red-200"
                : "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
            }`}
          >
            {errorMessage ? (
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            ) : (
              <Activity className="mt-0.5 h-5 w-5 shrink-0" />
            )}

            <div>
              <p className="font-bold">
                {errorMessage
                  ? "Pricing Engine Alert"
                  : runningEngine
                    ? "AI pricing analysis in progress"
                    : "Pricing intelligence updated"}
              </p>

              <p className="mt-1 text-sm opacity-80">
                {errorMessage || message}

                {lastRunAt && !runningEngine
                  ? ` · ${formatRelative(lastRunAt)}`
                  : ""}
              </p>
            </div>
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            title="Revenue Opportunity"
            value={currency(metrics.totalRevenueOpportunity)}
            subtitle="Projected additional route revenue"
            icon={<CircleDollarSign className="h-6 w-6" />}
            tone="green"
          />

          <MetricCard
            title="Surge Routes"
            value={metrics.surgeRoutes}
            subtitle={`${metrics.criticalRoutes} critical routes`}
            icon={<Zap className="h-6 w-6" />}
            tone={
              metrics.criticalRoutes > 0 ? "red" : "amber"
            }
          />

          <MetricCard
            title="Average AI Price"
            value={currency(metrics.averageRecommendedPrice)}
            subtitle="Recommended marketplace fare"
            icon={<WalletCards className="h-6 w-6" />}
            tone="cyan"
          />

          <MetricCard
            title="Average Surge"
            value={`${metrics.averageSurge.toFixed(2)}x`}
            subtitle="Dynamic marketplace multiplier"
            icon={<TrendingUp className="h-6 w-6" />}
            tone="purple"
          />

          <MetricCard
            title="Market Balance"
            value={`${Math.round(
              (metrics.averageSupply +
                (100 - metrics.averageDemand)) /
                2,
            )}%`}
            subtitle={`Demand ${Math.round(
              metrics.averageDemand,
            )} · Supply ${Math.round(metrics.averageSupply)}`}
            icon={<Gauge className="h-6 w-6" />}
            tone="green"
          />
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.48fr]">
          <article className="overflow-hidden rounded-[2rem] border border-white/[0.07] bg-slate-950/55 shadow-2xl shadow-black/25 backdrop-blur-2xl">
            <div className="border-b border-white/[0.06] p-5 sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Route className="h-5 w-5 text-emerald-300" />

                    <h2 className="text-xl font-black">
                      Route pricing intelligence
                    </h2>
                  </div>

                  <p className="mt-2 text-sm text-slate-500">
                    AI recommendations ranked by demand, supply and
                    revenue opportunity.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm("");
                    setStatusFilter("all");
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm font-bold text-slate-300 transition hover:border-white/[0.14] hover:bg-white/[0.07]"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Reset filters
                </button>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
                <label className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

                  <input
                    type="search"
                    value={searchTerm}
                    onChange={(event) =>
                      setSearchTerm(event.target.value)
                    }
                    placeholder="Search origin, destination or route..."
                    className="h-12 w-full rounded-2xl border border-white/[0.08] bg-slate-900/70 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-400/40 focus:ring-4 focus:ring-emerald-500/5"
                  />
                </label>

                <label className="relative">
                  <SlidersHorizontal className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

                  <select
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(
                        event.target.value as StatusFilter,
                      )
                    }
                    className="h-12 min-w-44 appearance-none rounded-2xl border border-white/[0.08] bg-slate-900/70 pl-10 pr-10 text-sm font-semibold text-slate-300 outline-none"
                  >
                    <option value="all">All pricing status</option>
                    <option value="critical">Critical</option>
                    <option value="surge">Surge</option>
                    <option value="watch">Watch</option>
                    <option value="stable">Stable</option>
                  </select>

                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </label>
              </div>
            </div>

            <div className="max-h-[1050px] overflow-y-auto">
              {loading ? (
                <div className="flex min-h-96 flex-col items-center justify-center">
                  <Loader2 className="h-10 w-10 animate-spin text-emerald-300" />

                  <p className="mt-4 font-bold text-slate-300">
                    Loading pricing intelligence...
                  </p>
                </div>
              ) : filteredRoutes.length === 0 ? (
                <div className="flex min-h-96 flex-col items-center justify-center px-6 text-center">
                  <BrainCircuit className="h-12 w-12 text-emerald-300" />

                  <p className="mt-4 text-lg font-black">
                    No route pricing data
                  </p>

                  <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                    Run the AI Pricing Engine to calculate intelligent
                    pricing recommendations for RoadLink routes.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.05]">
                  {filteredRoutes.map((routeItem) => (
                    <button
                      key={routeItem.id}
                      type="button"
                      onClick={() => setSelectedRoute(routeItem)}
                      className="group w-full p-5 text-left transition hover:bg-white/[0.025] sm:p-6"
                    >
                      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
                                statusStyles[routeItem.status]
                              }`}
                            >
                              {statusLabels[routeItem.status]}
                            </span>

                            <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-violet-300">
                              {routeItem.surgeMultiplier.toFixed(2)}x
                              surge
                            </span>

                            <span className="rounded-full border border-white/[0.07] bg-white/[0.035] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                              {routeItem.confidence}% confidence
                            </span>
                          </div>

                          <div className="mt-3 flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/15 bg-emerald-500/10">
                              <MapPin className="h-5 w-5 text-emerald-300" />
                            </div>

                            <div className="min-w-0">
                              <h3 className="truncate text-base font-black text-white transition group-hover:text-emerald-300 sm:text-lg">
                                {routeItem.from} → {routeItem.to}
                              </h3>

                              <p className="mt-1 text-xs text-slate-500">
                                {routeItem.averageDistanceMiles} miles ·{" "}
                                {routeItem.averageDurationMinutes} min ·{" "}
                                {routeItem.activeRides} active rides
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-3 sm:grid-cols-4">
                            <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
                              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">
                                Demand
                              </p>

                              <p className="mt-1 text-lg font-black text-white">
                                {routeItem.demandScore}
                              </p>
                            </div>

                            <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
                              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">
                                Supply
                              </p>

                              <p className="mt-1 text-lg font-black text-white">
                                {routeItem.supplyScore}
                              </p>
                            </div>

                            <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
                              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">
                                Bookings
                              </p>

                              <p className="mt-1 text-lg font-black text-white">
                                {routeItem.bookings}
                              </p>
                            </div>

                            <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
                              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">
                                Opportunity
                              </p>

                              <p className="mt-1 text-lg font-black text-emerald-300">
                                {currency(
                                  routeItem.revenueOpportunity,
                                )}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center justify-between gap-5 xl:flex-col xl:items-end">
                          <div className="text-left xl:text-right">
                            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                              Recommended price
                            </p>

                            <p className="mt-1 text-3xl font-black text-emerald-300">
                              {currency(routeItem.recommendedPrice)}
                            </p>

                            <div className="mt-2">
                              <ComparisonBadge
                                currentPrice={
                                  routeItem.averageCurrentPrice
                                }
                                recommendedPrice={
                                  routeItem.recommendedPrice
                                }
                              />
                            </div>
                          </div>

                          <div className="text-right">
                            <p className="text-xs text-slate-500">
                              Current average
                            </p>

                            <p className="mt-1 text-lg font-black text-slate-300">
                              {currency(
                                routeItem.averageCurrentPrice,
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </article>

          <aside className="space-y-6">
            <article className="rounded-[2rem] border border-white/[0.07] bg-slate-950/55 p-5 shadow-2xl shadow-black/25 backdrop-blur-2xl sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black">
                    Pricing controls
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Global AI pricing configuration
                  </p>
                </div>

                <Settings2 className="h-6 w-6 text-emerald-300" />
              </div>

              <div className="mt-5 flex items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
                <div>
                  <p className="text-sm font-black text-white">
                    Pricing Engine
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Enable AI pricing calculations
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    updateRule(
                      "enabled",
                      !pricingRules.enabled,
                    )
                  }
                  className={`relative h-7 w-13 rounded-full transition ${
                    pricingRules.enabled
                      ? "bg-emerald-500"
                      : "bg-slate-700"
                  }`}
                  aria-label="Toggle pricing engine"
                >
                  <span
                    className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
                      pricingRules.enabled
                        ? "left-7"
                        : "left-1"
                    }`}
                  />
                </button>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <label>
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                    Base fare
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={pricingRules.baseFare}
                    onChange={(event) =>
                      updateRule(
                        "baseFare",
                        safeNumber(event.target.value),
                      )
                    }
                    className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-slate-900/70 px-3 text-sm text-white outline-none focus:border-emerald-400/40"
                  />
                </label>

                <label>
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                    Per mile
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={pricingRules.perMileRate}
                    onChange={(event) =>
                      updateRule(
                        "perMileRate",
                        safeNumber(event.target.value),
                      )
                    }
                    className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-slate-900/70 px-3 text-sm text-white outline-none focus:border-emerald-400/40"
                  />
                </label>

                <label>
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                    Minimum fare
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={pricingRules.minimumFare}
                    onChange={(event) =>
                      updateRule(
                        "minimumFare",
                        safeNumber(event.target.value),
                      )
                    }
                    className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-slate-900/70 px-3 text-sm text-white outline-none focus:border-emerald-400/40"
                  />
                </label>

                <label>
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                    Maximum fare
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={pricingRules.maximumFare}
                    onChange={(event) =>
                      updateRule(
                        "maximumFare",
                        safeNumber(event.target.value),
                      )
                    }
                    className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-slate-900/70 px-3 text-sm text-white outline-none focus:border-emerald-400/40"
                  />
                </label>

                <label>
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                    Minimum surge
                  </span>

                  <input
                    type="number"
                    min="1"
                    max="5"
                    step="0.05"
                    value={pricingRules.minimumSurge}
                    onChange={(event) =>
                      updateRule(
                        "minimumSurge",
                        safeNumber(event.target.value),
                      )
                    }
                    className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-slate-900/70 px-3 text-sm text-white outline-none focus:border-emerald-400/40"
                  />
                </label>

                <label>
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                    Maximum surge
                  </span>

                  <input
                    type="number"
                    min="1"
                    max="5"
                    step="0.05"
                    value={pricingRules.maximumSurge}
                    onChange={(event) =>
                      updateRule(
                        "maximumSurge",
                        safeNumber(event.target.value),
                      )
                    }
                    className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-slate-900/70 px-3 text-sm text-white outline-none focus:border-emerald-400/40"
                  />
                </label>
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                      Demand weight
                    </span>

                    <span className="text-xs font-black text-white">
                      {pricingRules.demandWeight}%
                    </span>
                  </div>

                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={pricingRules.demandWeight}
                    onChange={(event) =>
                      updateRule(
                        "demandWeight",
                        safeNumber(event.target.value),
                      )
                    }
                    className="mt-2 w-full accent-emerald-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                      Supply weight
                    </span>

                    <span className="text-xs font-black text-white">
                      {pricingRules.supplyWeight}%
                    </span>
                  </div>

                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={pricingRules.supplyWeight}
                    onChange={(event) =>
                      updateRule(
                        "supplyWeight",
                        safeNumber(event.target.value),
                      )
                    }
                    className="mt-2 w-full accent-emerald-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                      Booking velocity
                    </span>

                    <span className="text-xs font-black text-white">
                      {pricingRules.bookingVelocityWeight}%
                    </span>
                  </div>

                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={
                      pricingRules.bookingVelocityWeight
                    }
                    onChange={(event) =>
                      updateRule(
                        "bookingVelocityWeight",
                        safeNumber(event.target.value),
                      )
                    }
                    className="mt-2 w-full accent-emerald-500"
                  />
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
                <div>
                  <p className="text-sm font-black text-white">
                    Automatic application
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Prepare recommendations for automated pricing
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    updateRule(
                      "autoApply",
                      !pricingRules.autoApply,
                    )
                  }
                  className={`relative h-7 w-13 rounded-full transition ${
                    pricingRules.autoApply
                      ? "bg-emerald-500"
                      : "bg-slate-700"
                  }`}
                  aria-label="Toggle automatic pricing"
                >
                  <span
                    className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
                      pricingRules.autoApply
                        ? "left-7"
                        : "left-1"
                    }`}
                  />
                </button>
              </div>

              <button
                type="button"
                onClick={savePricingRules}
                disabled={savingRules}
                className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 text-sm font-black text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingRules ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}

                Save pricing rules
              </button>
            </article>

            <article className="rounded-[2rem] border border-white/[0.07] bg-slate-950/55 p-5 shadow-2xl shadow-black/25 backdrop-blur-2xl sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black">
                    Top opportunities
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Highest projected revenue uplift
                  </p>
                </div>

                <BarChart3 className="h-6 w-6 text-violet-300" />
              </div>

              <div className="mt-5 space-y-3">
                {topOpportunityRoutes.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/[0.08] p-6 text-center">
                    <Target className="mx-auto h-8 w-8 text-emerald-300" />

                    <p className="mt-3 text-sm font-bold text-slate-300">
                      No pricing opportunities calculated
                    </p>
                  </div>
                ) : (
                  topOpportunityRoutes.map(
                    (routeItem, index) => (
                      <button
                        key={routeItem.id}
                        type="button"
                        onClick={() =>
                          setSelectedRoute(routeItem)
                        }
                        className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3 text-left transition hover:border-emerald-400/20 hover:bg-emerald-400/[0.04]"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-sm font-black text-slate-300">
                          {index + 1}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-white">
                            {routeItem.from} → {routeItem.to}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {routeItem.surgeMultiplier.toFixed(2)}x
                            surge
                          </p>
                        </div>

                        <p className="text-sm font-black text-emerald-300">
                          {currency(
                            routeItem.revenueOpportunity,
                          )}
                        </p>
                      </button>
                    ),
                  )
                )}
              </div>
            </article>
          </aside>
        </section>
      </div>

      {selectedRoute && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-md sm:items-center sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-label="Route pricing details"
        >
          <button
            type="button"
            onClick={() => setSelectedRoute(null)}
            className="absolute inset-0 cursor-default"
            aria-label="Close pricing details"
          />

          <div className="relative z-10 max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-t-[2rem] border border-white/[0.08] bg-[#030712] shadow-2xl shadow-black sm:rounded-[2rem]">
            <div className="sticky top-0 z-20 flex items-center justify-between border-b border-white/[0.06] bg-[#030712]/95 p-5 backdrop-blur-xl sm:p-6">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
                      statusStyles[selectedRoute.status]
                    }`}
                  >
                    {statusLabels[selectedRoute.status]}
                  </span>

                  <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-violet-300">
                    {selectedRoute.surgeMultiplier.toFixed(2)}x
                    multiplier
                  </span>
                </div>

                <h2 className="mt-3 truncate text-xl font-black sm:text-2xl">
                  {selectedRoute.from} → {selectedRoute.to}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setSelectedRoute(null)}
                className="ml-4 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-slate-400 transition hover:bg-white/[0.08] hover:text-white"
                aria-label="Close route pricing"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 sm:p-7">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-3xl border border-emerald-500/15 bg-emerald-500/[0.06] p-5">
                  <CircleDollarSign className="h-6 w-6 text-emerald-300" />

                  <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                    Recommended price
                  </p>

                  <p className="mt-2 text-3xl font-black text-emerald-300">
                    {currency(selectedRoute.recommendedPrice)}
                  </p>
                </div>

                <div className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-5">
                  <WalletCards className="h-6 w-6 text-cyan-300" />

                  <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                    Current average
                  </p>

                  <p className="mt-2 text-3xl font-black text-white">
                    {currency(
                      selectedRoute.averageCurrentPrice,
                    )}
                  </p>
                </div>

                <div className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-5">
                  <TrendingUp className="h-6 w-6 text-violet-300" />

                  <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                    Revenue opportunity
                  </p>

                  <p className="mt-2 text-3xl font-black text-white">
                    {currency(
                      selectedRoute.revenueOpportunity,
                    )}
                  </p>
                </div>

                <div className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-5">
                  <Target className="h-6 w-6 text-amber-300" />

                  <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                    AI confidence
                  </p>

                  <p className="mt-2 text-3xl font-black text-white">
                    {selectedRoute.confidence}%
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.85fr]">
                <div className="space-y-5">
                  <div className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-5">
                    <div className="flex items-center gap-2">
                      <BrainCircuit className="h-5 w-5 text-emerald-300" />

                      <h3 className="font-black">
                        AI pricing recommendation
                      </h3>
                    </div>

                    <p className="mt-4 text-sm leading-7 text-slate-300">
                      {selectedRoute.recommendation}
                    </p>

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-white/[0.05] bg-slate-950/50 p-4">
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-600">
                          Minimum
                        </p>

                        <p className="mt-2 text-xl font-black text-white">
                          {currency(
                            selectedRoute.minimumRecommendedPrice,
                          )}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.06] p-4">
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-400/70">
                          Target
                        </p>

                        <p className="mt-2 text-xl font-black text-emerald-300">
                          {currency(
                            selectedRoute.recommendedPrice,
                          )}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-white/[0.05] bg-slate-950/50 p-4">
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-600">
                          Maximum
                        </p>

                        <p className="mt-2 text-xl font-black text-white">
                          {currency(
                            selectedRoute.maximumRecommendedPrice,
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-5">
                    <div className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-cyan-300" />

                      <h3 className="font-black">
                        Marketplace pressure
                      </h3>
                    </div>

                    <div className="mt-5 space-y-5">
                      <ScoreBar
                        label="Demand"
                        value={selectedRoute.demandScore}
                      />

                      <ScoreBar
                        label="Supply"
                        value={selectedRoute.supplyScore}
                        inverse
                      />

                      <ScoreBar
                        label="Booking velocity"
                        value={
                          selectedRoute.bookingVelocityScore
                        }
                      />

                      <ScoreBar
                        label="Cancellation risk"
                        value={
                          selectedRoute.cancellationRiskScore
                        }
                      />

                      <ScoreBar
                        label="Market pressure"
                        value={selectedRoute.marketScore}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-5">
                    <div className="flex items-center gap-2">
                      <Map className="h-5 w-5 text-violet-300" />

                      <h3 className="font-black">
                        Route intelligence
                      </h3>
                    </div>

                    <dl className="mt-5 space-y-4">
                      {[
                        [
                          "Distance",
                          `${selectedRoute.averageDistanceMiles} miles`,
                        ],
                        [
                          "Duration",
                          `${selectedRoute.averageDurationMinutes} minutes`,
                        ],
                        [
                          "Total rides",
                          selectedRoute.rides,
                        ],
                        [
                          "Active rides",
                          selectedRoute.activeRides,
                        ],
                        [
                          "Available seats",
                          selectedRoute.availableSeats,
                        ],
                        [
                          "Total bookings",
                          selectedRoute.bookings,
                        ],
                        [
                          "Confirmed bookings",
                          selectedRoute.confirmedBookings,
                        ],
                        [
                          "Cancelled bookings",
                          selectedRoute.cancelledBookings,
                        ],
                        [
                          "Last calculated",
                          formatDate(
                            selectedRoute.lastCalculatedAt ||
                              selectedRoute.updatedAt,
                          ),
                        ],
                      ].map(([label, value]) => (
                        <div
                          key={String(label)}
                          className="flex items-center justify-between gap-4 border-b border-white/[0.05] pb-3 last:border-0 last:pb-0"
                        >
                          <dt className="text-sm text-slate-500">
                            {label}
                          </dt>

                          <dd className="text-right text-sm font-black text-slate-200">
                            {value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>

                  <div className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-5">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-emerald-300" />

                      <h3 className="font-black">
                        Pricing action
                      </h3>
                    </div>

                    <p className="mt-3 text-sm leading-6 text-slate-500">
                      Apply the AI recommendation to the route pricing
                      record and matching ride documents.
                    </p>

                    <button
                      type="button"
                      onClick={() =>
                        applyRecommendedPrice(selectedRoute)
                      }
                      disabled={
                        applyingRouteId === selectedRoute.id
                      }
                      className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 text-sm font-black text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {applyingRouteId === selectedRoute.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}

                      Apply {currency(
                        selectedRoute.recommendedPrice,
                      )} recommendation
                    </button>

                    {selectedRoute.appliedPrice !== undefined && (
                      <div className="mt-4 rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.06] p-4">
                        <div className="flex items-center gap-2 text-emerald-300">
                          <CheckCircle2 className="h-4 w-4" />

                          <p className="text-sm font-black">
                            Recommendation applied
                          </p>
                        </div>

                        <p className="mt-2 text-xs leading-5 text-emerald-100/70">
                          {currency(
                            selectedRoute.appliedPrice,
                          )} applied{" "}
                          {formatRelative(
                            selectedRoute.appliedAt,
                          )}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-4">
                      <CalendarDays className="h-5 w-5 text-cyan-300" />

                      <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-600">
                        Pricing window
                      </p>

                      <p className="mt-1 text-sm font-black text-slate-300">
                        Dynamic
                      </p>
                    </div>

                    <div className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-4">
                      <Clock3 className="h-5 w-5 text-amber-300" />

                      <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-600">
                        Recalculation
                      </p>

                      <p className="mt-1 text-sm font-black text-slate-300">
                        On demand
                      </p>
                    </div>

                    <div className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-4">
                      <UsersRound className="h-5 w-5 text-violet-300" />

                      <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-600">
                        Demand model
                      </p>

                      <p className="mt-1 text-sm font-black text-slate-300">
                        Marketplace
                      </p>
                    </div>

                    <div className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-4">
                      <Percent className="h-5 w-5 text-emerald-300" />

                      <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-600">
                        Platform fee
                      </p>

                      <p className="mt-1 text-sm font-black text-slate-300">
                        {percentage(
                          pricingRules.platformFeePercent,
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
