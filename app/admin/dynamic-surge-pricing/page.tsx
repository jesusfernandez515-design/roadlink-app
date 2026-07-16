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
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Eye,
  Flame,
  Gauge,
  History,
  Loader2,
  MapPin,
  Pause,
  Play,
  RefreshCcw,
  Route,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  UsersRound,
  WalletCards,
  XCircle,
  Zap,
} from "lucide-react";
import { auth, db } from "../../../lib/firebase";

type TimestampLike =
  | Date
  | string
  | number
  | null
  | undefined
  | {
      seconds?: number;
      nanoseconds?: number;
      toDate?: () => Date;
    };

type SurgeStatus =
  | "normal"
  | "watch"
  | "active"
  | "critical"
  | "paused";

type SurgeFilter = "all" | SurgeStatus;

type RideItem = {
  id: string;
  from?: string;
  to?: string;
  origin?: string;
  destination?: string;
  status?: string;
  price?: number;
  recommendedPrice?: number;
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
  amount?: number;
  price?: number;
  seatsBooked?: number;
  passengerId?: string;
  passengerEmail?: string;
  createdAt?: TimestampLike;
};

type SurgeRule = {
  id: string;
  enabled: boolean;
  automaticMode: boolean;
  minimumMultiplier: number;
  maximumMultiplier: number;
  activationDemandScore: number;
  criticalDemandScore: number;
  minimumSupplyScore: number;
  bookingVelocityThreshold: number;
  cancellationWeight: number;
  demandWeight: number;
  supplyWeight: number;
  velocityWeight: number;
  peakHourMultiplier: number;
  nightMultiplier: number;
  weekendMultiplier: number;
  cooldownMinutes: number;
  maximumPriceIncreasePercent: number;
  updatedAt?: TimestampLike;
  updatedBy?: string;
};

type SurgeRoute = {
  id: string;
  routeKey: string;
  from: string;
  to: string;
  status: SurgeStatus;
  rides: number;
  activeRides: number;
  bookings: number;
  recentBookings: number;
  bookingsLastHour: number;
  availableSeats: number;
  seatsBooked: number;
  averagePrice: number;
  averageDistanceMiles: number;
  demandScore: number;
  supplyScore: number;
  velocityScore: number;
  cancellationScore: number;
  pressureScore: number;
  recommendedMultiplier: number;
  activeMultiplier: number;
  recommendedPrice: number;
  projectedRevenueLift: number;
  confidence: number;
  recommendation: string;
  automaticApplied: boolean;
  paused: boolean;
  createdAt?: TimestampLike;
  updatedAt?: TimestampLike;
  lastCalculatedAt?: TimestampLike;
  activatedAt?: TimestampLike;
  activatedBy?: string;
  deactivatedAt?: TimestampLike;
  deactivatedBy?: string;
};

type SurgeEvent = {
  id: string;
  routeId?: string;
  routeKey?: string;
  from?: string;
  to?: string;
  action?: string;
  previousMultiplier?: number;
  newMultiplier?: number;
  previousStatus?: SurgeStatus;
  newStatus?: SurgeStatus;
  reason?: string;
  createdAt?: TimestampLike;
  createdBy?: string;
};

const COLLECTION_LIMIT = 2000;

const DEFAULT_RULES: SurgeRule = {
  id: "main",
  enabled: true,
  automaticMode: false,
  minimumMultiplier: 1,
  maximumMultiplier: 2.5,
  activationDemandScore: 65,
  criticalDemandScore: 85,
  minimumSupplyScore: 40,
  bookingVelocityThreshold: 55,
  cancellationWeight: 15,
  demandWeight: 35,
  supplyWeight: 30,
  velocityWeight: 20,
  peakHourMultiplier: 1.15,
  nightMultiplier: 1.12,
  weekendMultiplier: 1.08,
  cooldownMinutes: 30,
  maximumPriceIncreasePercent: 150,
};

const STATUS_LABELS: Record<SurgeStatus, string> = {
  normal: "Normal",
  watch: "Watch",
  active: "Active",
  critical: "Critical",
  paused: "Paused",
};

const STATUS_STYLES: Record<SurgeStatus, string> = {
  normal:
    "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  watch:
    "border-amber-500/25 bg-amber-500/10 text-amber-300",
  active:
    "border-orange-500/25 bg-orange-500/10 text-orange-300",
  critical:
    "border-red-500/25 bg-red-500/10 text-red-300",
  paused:
    "border-slate-500/25 bg-slate-500/10 text-slate-300",
};

function safeNumber(value: unknown) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(
  value: number,
  minimum = 0,
  maximum = 100,
) {
  return Math.min(maximum, Math.max(minimum, value));
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

function isWithinHours(value: TimestampLike, hours: number) {
  const timestamp = getTime(value);

  if (!timestamp) return false;

  return timestamp >= Date.now() - hours * 60 * 60 * 1000;
}

function isWithinDays(value: TimestampLike, days: number) {
  return isWithinHours(value, days * 24);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function getRouteData(ride: RideItem) {
  const from = String(
    ride.from || ride.origin || "Unknown origin",
  ).trim();

  const to = String(
    ride.to || ride.destination || "Unknown destination",
  ).trim();

  return {
    from,
    to,
    key: `${normalizeString(from)}__${normalizeString(to)}`,
  };
}

function createRouteId(routeKey: string) {
  return routeKey
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

function getRideDistance(ride: RideItem) {
  return Math.max(
    safeNumber(ride.distanceMiles),
    safeNumber(ride.distance),
  );
}

function resolveStatus({
  paused,
  pressureScore,
  demandScore,
  supplyScore,
  multiplier,
  rules,
}: {
  paused: boolean;
  pressureScore: number;
  demandScore: number;
  supplyScore: number;
  multiplier: number;
  rules: SurgeRule;
}): SurgeStatus {
  if (paused) return "paused";

  if (
    demandScore >= rules.criticalDemandScore &&
    supplyScore <= rules.minimumSupplyScore &&
    multiplier >= 1.75
  ) {
    return "critical";
  }

  if (
    pressureScore >= rules.activationDemandScore ||
    multiplier >= 1.35
  ) {
    return "active";
  }

  if (
    demandScore >= rules.activationDemandScore - 15 ||
    supplyScore <= rules.minimumSupplyScore + 15
  ) {
    return "watch";
  }

  return "normal";
}

async function fetchCollection<T>(
  collectionName: string,
): Promise<T[]> {
  const snapshot = await getDocs(
    query(
      collection(db, collectionName),
      limit(COLLECTION_LIMIT),
    ),
  );

  return snapshot.docs.map(
    (document) =>
      ({
        id: document.id,
        ...document.data(),
      }) as T,
  );
}

function calculateSurgeRoutes({
  rides,
  bookings,
  rules,
  existingRoutes,
}: {
  rides: RideItem[];
  bookings: BookingItem[];
  rules: SurgeRule;
  existingRoutes: SurgeRoute[];
}) {
  const existingByRouteKey = new globalThis.Map<
    string,
    SurgeRoute
  >(
    existingRoutes.map((routeItem) => [
      routeItem.routeKey,
      routeItem,
    ]),
  );

  const routeGroups = new globalThis.Map<
    string,
    RideItem[]
  >();

  for (const ride of rides) {
    const route = getRouteData(ride);
    const group = routeGroups.get(route.key) ?? [];

    routeGroups.set(route.key, [...group, ride]);
  }

  const results: SurgeRoute[] = [];

  for (const [routeKey, routeRides] of routeGroups.entries()) {
    const firstRide = routeRides[0];

    if (!firstRide) continue;

    const route = getRouteData(firstRide);
    const existing = existingByRouteKey.get(routeKey);

    const rideIds = new Set(
      routeRides.map((ride) => ride.id),
    );

    const routeBookings = bookings.filter(
      (booking) =>
        Boolean(booking.rideId) &&
        rideIds.has(String(booking.rideId)),
    );

    const activeRides = routeRides.filter((ride) =>
      [
        "active",
        "open",
        "published",
        "available",
        "scheduled",
      ].includes(normalizeStatus(ride.status)),
    );

    const recentBookings = routeBookings.filter((booking) =>
      isWithinDays(booking.createdAt, 7),
    );

    const bookingsLastHour = routeBookings.filter((booking) =>
      isWithinHours(booking.createdAt, 1),
    );

    const confirmedBookings = routeBookings.filter((booking) =>
      [
        "confirmed",
        "accepted",
        "reserved",
        "completed",
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

    const cancelledRides = routeRides.filter((ride) =>
      ["cancelled", "canceled", "failed"].includes(
        normalizeStatus(ride.status),
      ),
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
        total +
        Math.max(safeNumber(booking.seatsBooked), 1),
      0,
    );

    const validPrices = routeRides
      .map((ride) =>
        Math.max(
          safeNumber(ride.price),
          safeNumber(ride.recommendedPrice),
        ),
      )
      .filter((price) => price > 0);

    const averagePrice =
      validPrices.length > 0
        ? validPrices.reduce(
            (total, price) => total + price,
            0,
          ) / validPrices.length
        : 10;

    const validDistances = routeRides
      .map(getRideDistance)
      .filter((distance) => distance > 0);

    const averageDistanceMiles =
      validDistances.length > 0
        ? validDistances.reduce(
            (total, distance) => total + distance,
            0,
          ) / validDistances.length
        : 0;

    const demandScore = clamp(
      confirmedBookings.length * 6 +
        recentBookings.length * 7 +
        bookingsLastHour.length * 18 +
        Math.min(seatsBooked * 3, 25),
    );

    const supplyScore = clamp(
      activeRides.length * 18 +
        availableSeats * 6 -
        seatsBooked * 2,
    );

    const velocityScore = clamp(
      bookingsLastHour.length * 25 +
        recentBookings.length * 5,
    );

    const totalCancellations =
      cancelledBookings.length + cancelledRides.length;

    const totalActivity =
      routeBookings.length + routeRides.length;

    const cancellationScore =
      totalActivity > 0
        ? clamp(
            (totalCancellations / totalActivity) * 100,
          )
        : 0;

    const demandPressure =
      (demandScore / 100) * (rules.demandWeight / 100);

    const supplyPressure =
      ((100 - supplyScore) / 100) *
      (rules.supplyWeight / 100);

    const velocityPressure =
      (velocityScore / 100) *
      (rules.velocityWeight / 100);

    const cancellationPressure =
      (cancellationScore / 100) *
      (rules.cancellationWeight / 100);

    const combinedPressure =
      demandPressure +
      supplyPressure +
      velocityPressure +
      cancellationPressure;

    const pressureScore = clamp(combinedPressure * 100);

    const currentDate = new Date();
    const currentHour = currentDate.getHours();
    const currentDay = currentDate.getDay();

    const isWeekend =
      currentDay === 0 || currentDay === 6;

    const isNight =
      currentHour >= 21 || currentHour <= 5;

    const isPeakHour =
      (currentHour >= 6 && currentHour <= 9) ||
      (currentHour >= 16 && currentHour <= 19);

    const timeMultiplier =
      (isWeekend ? rules.weekendMultiplier : 1) *
      (isNight ? rules.nightMultiplier : 1) *
      (isPeakHour ? rules.peakHourMultiplier : 1);

    const pressureMultiplier =
      rules.minimumMultiplier +
      combinedPressure *
        Math.max(rules.maximumMultiplier - 1, 0);

    const maximumAllowedByPercentage =
      1 + rules.maximumPriceIncreasePercent / 100;

    const recommendedMultiplier = clamp(
      pressureMultiplier * timeMultiplier,
      rules.minimumMultiplier,
      Math.min(
        rules.maximumMultiplier,
        maximumAllowedByPercentage,
      ),
    );

    const roundedMultiplier =
      Math.round(recommendedMultiplier * 100) / 100;

    const paused = existing?.paused ?? false;

    const status = resolveStatus({
      paused,
      pressureScore,
      demandScore,
      supplyScore,
      multiplier: roundedMultiplier,
      rules,
    });

    const activeMultiplier =
      existing?.activeMultiplier &&
      existing.activeMultiplier >= 1
        ? existing.activeMultiplier
        : 1;

    const recommendedPrice = roundMoney(
      averagePrice * roundedMultiplier,
    );

    const projectedTransactions = Math.max(
      confirmedBookings.length,
      Math.round(demandScore / 15),
      1,
    );

    const projectedRevenueLift = roundMoney(
      Math.max(recommendedPrice - averagePrice, 0) *
        projectedTransactions,
    );

    const confidence = clamp(
      45 +
        Math.min(routeRides.length * 5, 20) +
        Math.min(routeBookings.length * 3, 25) +
        (averageDistanceMiles > 0 ? 8 : 0),
      0,
      99,
    );

    let recommendation =
      "Keep normal pricing and continue monitoring this route.";

    if (status === "critical") {
      recommendation =
        "Activate critical surge pricing immediately and recruit additional drivers for this route.";
    } else if (status === "active") {
      recommendation =
        "Activate dynamic surge pricing while demand remains above available supply.";
    } else if (status === "watch") {
      recommendation =
        "Monitor booking velocity closely. Surge activation may be required soon.";
    } else if (status === "paused") {
      recommendation =
        "Surge pricing is paused manually. Review route conditions before resuming.";
    }

    results.push({
      id: existing?.id || createRouteId(routeKey),
      routeKey,
      from: route.from,
      to: route.to,
      status,
      rides: routeRides.length,
      activeRides: activeRides.length,
      bookings: routeBookings.length,
      recentBookings: recentBookings.length,
      bookingsLastHour: bookingsLastHour.length,
      availableSeats,
      seatsBooked,
      averagePrice: roundMoney(averagePrice),
      averageDistanceMiles:
        Math.round(averageDistanceMiles * 10) / 10,
      demandScore: Math.round(demandScore),
      supplyScore: Math.round(supplyScore),
      velocityScore: Math.round(velocityScore),
      cancellationScore: Math.round(cancellationScore),
      pressureScore: Math.round(pressureScore),
      recommendedMultiplier: roundedMultiplier,
      activeMultiplier,
      recommendedPrice,
      projectedRevenueLift,
      confidence: Math.round(confidence),
      recommendation,
      automaticApplied:
        existing?.automaticApplied ?? false,
      paused,
      activatedAt: existing?.activatedAt,
      activatedBy: existing?.activatedBy,
      deactivatedAt: existing?.deactivatedAt,
      deactivatedBy: existing?.deactivatedBy,
      createdAt: existing?.createdAt,
      updatedAt: existing?.updatedAt,
      lastCalculatedAt: existing?.lastCalculatedAt,
    });
  }

  return results.sort((first, second) => {
    const statusPriority: Record<SurgeStatus, number> = {
      critical: 5,
      active: 4,
      watch: 3,
      normal: 2,
      paused: 1,
    };

    const priorityDifference =
      statusPriority[second.status] -
      statusPriority[first.status];

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    return (
      second.pressureScore - first.pressureScore
    );
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
    red:
      "border-red-500/20 bg-red-500/10 text-red-300",
    amber:
      "border-amber-500/20 bg-amber-500/10 text-amber-300",
    cyan:
      "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
    purple:
      "border-violet-500/20 bg-violet-500/10 text-violet-300",
  };

  return (
    <article className="relative overflow-hidden rounded-3xl border border-white/[0.07] bg-slate-950/60 p-5 shadow-2xl shadow-black/20 backdrop-blur-2xl">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            {title}
          </p>

          <p className="mt-3 truncate text-3xl font-black text-white">
            {value}
          </p>

          <p className="mt-2 text-sm text-slate-400">
            {subtitle}
          </p>
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

  const gradient = inverse
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
        <span className="text-xs font-bold text-slate-400">
          {label}
        </span>

        <span className="text-xs font-black text-white">
          {Math.round(normalizedValue)}
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${gradient}`}
          style={{
            width: `${normalizedValue}%`,
          }}
        />
      </div>
    </div>
  );
}

function MultiplierChange({
  current,
  recommended,
}: {
  current: number;
  recommended: number;
}) {
  const difference = recommended - current;

  if (Math.abs(difference) < 0.01) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-slate-500/20 bg-slate-500/10 px-2.5 py-1 text-xs font-black text-slate-300">
        No change
      </span>
    );
  }

  if (difference > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-orange-500/20 bg-orange-500/10 px-2.5 py-1 text-xs font-black text-orange-300">
        <ArrowUpRight className="h-3.5 w-3.5" />
        +{difference.toFixed(2)}x
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-black text-emerald-300">
      <ArrowDownRight className="h-3.5 w-3.5" />
      {difference.toFixed(2)}x
    </span>
  );
}

export default function DynamicSurgePricingPage() {
  const [rules, setRules] =
    useState<SurgeRule>(DEFAULT_RULES);

  const [routes, setRoutes] = useState<SurgeRoute[]>([]);
  const [events, setEvents] = useState<SurgeEvent[]>([]);

  const [selectedRoute, setSelectedRoute] =
    useState<SurgeRoute | null>(null);

  const [loading, setLoading] = useState(true);
  const [runningEngine, setRunningEngine] = useState(false);
  const [savingRules, setSavingRules] = useState(false);

  const [updatingRouteId, setUpdatingRouteId] =
    useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<SurgeFilter>("all");

  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [lastRunAt, setLastRunAt] =
    useState<Date | null>(null);

  useEffect(() => {
    const unsubscribeRules = onSnapshot(
      doc(db, "surgeRules", "main"),
      (snapshot) => {
        if (snapshot.exists()) {
          setRules({
            ...DEFAULT_RULES,
            id: snapshot.id,
            ...snapshot.data(),
          } as SurgeRule);
        }
      },
      (error) => {
        console.error(
          "Surge rules listener failed:",
          error,
        );

        setErrorMessage(
          "RoadLink could not load the surge pricing rules.",
        );
      },
    );

    const unsubscribeRoutes = onSnapshot(
      query(
        collection(db, "surgeRoutes"),
        limit(500),
      ),
      (snapshot) => {
        const items = snapshot.docs.map(
          (document) =>
            ({
              id: document.id,
              ...document.data(),
            }) as SurgeRoute,
        );

        setRoutes(
          items.sort(
            (first, second) =>
              safeNumber(second.pressureScore) -
              safeNumber(first.pressureScore),
          ),
        );

        setLoading(false);
      },
      (error) => {
        console.error(
          "Surge routes listener failed:",
          error,
        );

        setErrorMessage(
          "RoadLink could not load surge route intelligence.",
        );

        setLoading(false);
      },
    );

    const unsubscribeEvents = onSnapshot(
      query(
        collection(db, "surgeEvents"),
        limit(100),
      ),
      (snapshot) => {
        const items = snapshot.docs.map(
          (document) =>
            ({
              id: document.id,
              ...document.data(),
            }) as SurgeEvent,
        );

        setEvents(
          items
            .sort(
              (first, second) =>
                getTime(second.createdAt) -
                getTime(first.createdAt),
            )
            .slice(0, 20),
        );
      },
      (error) => {
        console.error(
          "Surge events listener failed:",
          error,
        );
      },
    );

    return () => {
      unsubscribeRules();
      unsubscribeRoutes();
      unsubscribeEvents();
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
      const reference = doc(
        collection(db, "auditLogs"),
      );

      await setDoc(reference, {
        id: reference.id,
        module: "dynamic-surge-pricing",
        action,
        description,
        entityId: entityId ?? null,
        metadata: metadata ?? {},
        actorId: auth.currentUser?.uid || "system",
        actorEmail:
          auth.currentUser?.email ||
          "dynamic-surge-engine@roadlink.system",
        createdAt: serverTimestamp(),
      });
    },
    [],
  );

  const createNotification = useCallback(
    async ({
      title,
      notificationMessage,
      severity,
      entityId,
    }: {
      title: string;
      notificationMessage: string;
      severity:
        | "low"
        | "medium"
        | "high"
        | "critical";
      entityId?: string;
    }) => {
      const reference = doc(
        collection(db, "notifications"),
      );

      await setDoc(reference, {
        id: reference.id,
        title,
        message: notificationMessage,
        type: "surge_pricing_alert",
        severity,
        audience: "admin",
        entityId: entityId ?? null,
        read: false,
        createdAt: serverTimestamp(),
        createdBy:
          auth.currentUser?.email ||
          "dynamic-surge-engine",
      });
    },
    [],
  );

  const createSurgeEvent = useCallback(
    async ({
      route,
      action,
      previousMultiplier,
      newMultiplier,
      previousStatus,
      newStatus,
      reason,
    }: {
      route: SurgeRoute;
      action: string;
      previousMultiplier: number;
      newMultiplier: number;
      previousStatus: SurgeStatus;
      newStatus: SurgeStatus;
      reason: string;
    }) => {
      const reference = doc(
        collection(db, "surgeEvents"),
      );

      await setDoc(reference, {
        id: reference.id,
        routeId: route.id,
        routeKey: route.routeKey,
        from: route.from,
        to: route.to,
        action,
        previousMultiplier,
        newMultiplier,
        previousStatus,
        newStatus,
        reason,
        createdAt: serverTimestamp(),
        createdBy:
          auth.currentUser?.email ||
          "dynamic-surge-engine",
      });
    },
    [],
  );

  function updateRule<K extends keyof SurgeRule>(
    key: K,
    value: SurgeRule[K],
  ) {
    setRules((current) => ({
      ...current,
      [key]: value,
    }));
  }

  const saveRules = useCallback(async () => {
    setSavingRules(true);
    setMessage("");
    setErrorMessage("");

    try {
      const normalizedRules: SurgeRule = {
        ...rules,
        minimumMultiplier: clamp(
          safeNumber(rules.minimumMultiplier),
          1,
          5,
        ),
        maximumMultiplier: clamp(
          safeNumber(rules.maximumMultiplier),
          Math.max(
            safeNumber(rules.minimumMultiplier),
            1,
          ),
          5,
        ),
        activationDemandScore: clamp(
          safeNumber(rules.activationDemandScore),
        ),
        criticalDemandScore: clamp(
          safeNumber(rules.criticalDemandScore),
        ),
        minimumSupplyScore: clamp(
          safeNumber(rules.minimumSupplyScore),
        ),
        bookingVelocityThreshold: clamp(
          safeNumber(
            rules.bookingVelocityThreshold,
          ),
        ),
        cancellationWeight: clamp(
          safeNumber(rules.cancellationWeight),
        ),
        demandWeight: clamp(
          safeNumber(rules.demandWeight),
        ),
        supplyWeight: clamp(
          safeNumber(rules.supplyWeight),
        ),
        velocityWeight: clamp(
          safeNumber(rules.velocityWeight),
        ),
        peakHourMultiplier: clamp(
          safeNumber(rules.peakHourMultiplier),
          1,
          3,
        ),
        nightMultiplier: clamp(
          safeNumber(rules.nightMultiplier),
          1,
          3,
        ),
        weekendMultiplier: clamp(
          safeNumber(rules.weekendMultiplier),
          1,
          3,
        ),
        cooldownMinutes: clamp(
          safeNumber(rules.cooldownMinutes),
          0,
          1440,
        ),
        maximumPriceIncreasePercent: clamp(
          safeNumber(
            rules.maximumPriceIncreasePercent,
          ),
          0,
          400,
        ),
      };

      await setDoc(
        doc(db, "surgeRules", "main"),
        {
          ...normalizedRules,
          id: "main",
          updatedAt: serverTimestamp(),
          updatedBy:
            auth.currentUser?.email ||
            "RoadLink Admin",
        },
        { merge: true },
      );

      await createAuditLog({
        action: "SURGE_RULES_UPDATED",
        description:
          "Dynamic surge pricing rules were updated.",
        entityId: "surgeRules/main",
        metadata: {
          enabled: normalizedRules.enabled,
          automaticMode:
            normalizedRules.automaticMode,
          minimumMultiplier:
            normalizedRules.minimumMultiplier,
          maximumMultiplier:
            normalizedRules.maximumMultiplier,
          activationDemandScore:
            normalizedRules.activationDemandScore,
        },
      });

      setRules(normalizedRules);
      setMessage(
        "Dynamic surge pricing rules saved successfully.",
      );
    } catch (error) {
      console.error("Save surge rules failed:", error);

      setErrorMessage(
        "RoadLink could not save the surge pricing rules.",
      );
    } finally {
      setSavingRules(false);
    }
  }, [createAuditLog, rules]);

  const runSurgeEngine = useCallback(async () => {
    setRunningEngine(true);
    setMessage(
      "Loading live marketplace demand and supply signals...",
    );
    setErrorMessage("");

    try {
      const [rides, bookings] = await Promise.all([
        fetchCollection<RideItem>("rides"),
        fetchCollection<BookingItem>("bookings"),
      ]);

      setMessage(
        "Calculating dynamic surge pressure by route...",
      );

      const results = calculateSurgeRoutes({
        rides,
        bookings,
        rules,
        existingRoutes: routes,
      });

      let automaticallyActivated = 0;
      let criticalRoutes = 0;

      for (
        let startIndex = 0;
        startIndex < results.length;
        startIndex += 350
      ) {
        const batch = writeBatch(db);
        const chunk = results.slice(
          startIndex,
          startIndex + 350,
        );

        for (const routeItem of chunk) {
          const shouldAutoApply =
            rules.enabled &&
            rules.automaticMode &&
            !routeItem.paused &&
            (routeItem.status === "active" ||
              routeItem.status === "critical");

          const activeMultiplier = shouldAutoApply
            ? routeItem.recommendedMultiplier
            : routeItem.activeMultiplier;

          if (
            shouldAutoApply &&
            activeMultiplier !==
              routeItem.activeMultiplier
          ) {
            automaticallyActivated += 1;
          }

          if (routeItem.status === "critical") {
            criticalRoutes += 1;
          }

          batch.set(
            doc(db, "surgeRoutes", routeItem.id),
            {
              ...routeItem,
              activeMultiplier,
              automaticApplied: shouldAutoApply,
              lastCalculatedAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              createdAt:
                routeItem.createdAt ||
                serverTimestamp(),
              createdBy:
                "dynamic-surge-pricing-engine",
            },
            { merge: true },
          );
        }

        await batch.commit();
      }

      if (
        rules.enabled &&
        rules.automaticMode &&
        automaticallyActivated > 0
      ) {
        const ridesSnapshot = await getDocs(
          query(
            collection(db, "rides"),
            limit(COLLECTION_LIMIT),
          ),
        );

        const routesByKey = new globalThis.Map(
          results.map((routeItem) => [
            routeItem.routeKey,
            routeItem,
          ]),
        );

        const matchingRideDocuments =
          ridesSnapshot.docs.filter((document) => {
            const ride = {
              id: document.id,
              ...document.data(),
            } as RideItem;

            const routeItem = routesByKey.get(
              getRouteData(ride).key,
            );

            return Boolean(
              routeItem &&
                !routeItem.paused &&
                (routeItem.status === "active" ||
                  routeItem.status === "critical"),
            );
          });

        for (
          let startIndex = 0;
          startIndex < matchingRideDocuments.length;
          startIndex += 350
        ) {
          const batch = writeBatch(db);
          const chunk = matchingRideDocuments.slice(
            startIndex,
            startIndex + 350,
          );

          for (const rideDocument of chunk) {
            const ride = {
              id: rideDocument.id,
              ...rideDocument.data(),
            } as RideItem;

            const routeItem = routesByKey.get(
              getRouteData(ride).key,
            );

            if (!routeItem) continue;

            batch.update(rideDocument.ref, {
              surgeMultiplier:
                routeItem.recommendedMultiplier,
              surgeStatus: routeItem.status,
              surgeRecommendedPrice:
                routeItem.recommendedPrice,
              surgeUpdatedAt: serverTimestamp(),
              surgeAutomatic: true,
            });
          }

          await batch.commit();
        }
      }

      const projectedRevenueLift = results.reduce(
        (total, routeItem) =>
          total +
          safeNumber(
            routeItem.projectedRevenueLift,
          ),
        0,
      );

      const runReference = doc(
        collection(db, "surgeEngineRuns"),
      );

      await setDoc(runReference, {
        id: runReference.id,
        routesAnalyzed: results.length,
        ridesAnalyzed: rides.length,
        bookingsAnalyzed: bookings.length,
        criticalRoutes,
        automaticallyActivated,
        projectedRevenueLift,
        automaticMode: rules.automaticMode,
        createdAt: serverTimestamp(),
        createdBy:
          auth.currentUser?.email ||
          "dynamic-surge-pricing-engine",
      });

      await createAuditLog({
        action: "DYNAMIC_SURGE_ENGINE_COMPLETED",
        description: `Dynamic Surge Pricing analyzed ${results.length} routes.`,
        metadata: {
          routesAnalyzed: results.length,
          ridesAnalyzed: rides.length,
          bookingsAnalyzed: bookings.length,
          criticalRoutes,
          automaticallyActivated,
          projectedRevenueLift,
          automaticMode: rules.automaticMode,
        },
      });

      if (criticalRoutes > 0) {
        await createNotification({
          title: "Critical surge conditions detected",
          notificationMessage: `${criticalRoutes} route${
            criticalRoutes === 1 ? "" : "s"
          } currently show critical demand and supply imbalance.`,
          severity: "critical",
        });
      } else if (automaticallyActivated > 0) {
        await createNotification({
          title: "Automatic surge pricing activated",
          notificationMessage: `${automaticallyActivated} route${
            automaticallyActivated === 1 ? "" : "s"
          } received automatic surge pricing updates.`,
          severity: "high",
        });
      }

      setLastRunAt(new Date());

      setMessage(
        `${results.length} routes analyzed · ${criticalRoutes} critical · ${automaticallyActivated} auto-activated · ${formatCurrency(
          projectedRevenueLift,
        )} projected lift`,
      );
    } catch (error) {
      console.error(
        "Dynamic surge engine failed:",
        error,
      );

      setErrorMessage(
        "Dynamic surge analysis could not be completed. Verify Firestore permissions and marketplace data.",
      );

      setMessage("");
    } finally {
      setRunningEngine(false);
    }
  }, [
    createAuditLog,
    createNotification,
    routes,
    rules,
  ]);

  const updateRouteSurge = useCallback(
    async ({
      route,
      action,
    }: {
      route: SurgeRoute;
      action:
        | "activate"
        | "deactivate"
        | "pause"
        | "resume";
    }) => {
      setUpdatingRouteId(route.id);
      setMessage("");
      setErrorMessage("");

      try {
        let newMultiplier = route.activeMultiplier;
        let newStatus = route.status;
        let paused = route.paused;
        let reason = "";

        if (action === "activate") {
          newMultiplier =
            route.recommendedMultiplier;
          newStatus =
            route.status === "critical"
              ? "critical"
              : "active";
          paused = false;
          reason =
            "Administrator activated the recommended surge multiplier.";
        }

        if (action === "deactivate") {
          newMultiplier = 1;
          newStatus = "normal";
          paused = false;
          reason =
            "Administrator deactivated surge pricing.";
        }

        if (action === "pause") {
          newStatus = "paused";
          paused = true;
          reason =
            "Administrator paused surge pricing for this route.";
        }

        if (action === "resume") {
          paused = false;
          newStatus = resolveStatus({
            paused: false,
            pressureScore: route.pressureScore,
            demandScore: route.demandScore,
            supplyScore: route.supplyScore,
            multiplier:
              route.recommendedMultiplier,
            rules,
          });
          reason =
            "Administrator resumed surge monitoring.";
        }

        await updateDoc(
          doc(db, "surgeRoutes", route.id),
          {
            activeMultiplier: newMultiplier,
            status: newStatus,
            paused,
            automaticApplied: false,
            activatedAt:
              action === "activate"
                ? serverTimestamp()
                : route.activatedAt || null,
            activatedBy:
              action === "activate"
                ? auth.currentUser?.email ||
                  "RoadLink Admin"
                : route.activatedBy || null,
            deactivatedAt:
              action === "deactivate"
                ? serverTimestamp()
                : route.deactivatedAt || null,
            deactivatedBy:
              action === "deactivate"
                ? auth.currentUser?.email ||
                  "RoadLink Admin"
                : route.deactivatedBy || null,
            updatedAt: serverTimestamp(),
          },
        );

        const ridesSnapshot = await getDocs(
          query(
            collection(db, "rides"),
            limit(COLLECTION_LIMIT),
          ),
        );

        const matchingRides =
          ridesSnapshot.docs.filter((document) => {
            const ride = {
              id: document.id,
              ...document.data(),
            } as RideItem;

            return (
              getRouteData(ride).key ===
              route.routeKey
            );
          });

        for (
          let startIndex = 0;
          startIndex < matchingRides.length;
          startIndex += 350
        ) {
          const batch = writeBatch(db);
          const chunk = matchingRides.slice(
            startIndex,
            startIndex + 350,
          );

          for (const rideDocument of chunk) {
            batch.update(rideDocument.ref, {
              surgeMultiplier: newMultiplier,
              surgeStatus: newStatus,
              surgePaused: paused,
              surgeRecommendedPrice:
                action === "deactivate"
                  ? null
                  : route.recommendedPrice,
              surgeUpdatedAt: serverTimestamp(),
              surgeAutomatic: false,
            });
          }

          await batch.commit();
        }

        await createSurgeEvent({
          route,
          action,
          previousMultiplier:
            route.activeMultiplier,
          newMultiplier,
          previousStatus: route.status,
          newStatus,
          reason,
        });

        await createAuditLog({
          action: `SURGE_ROUTE_${action.toUpperCase()}`,
          description: `${reason} ${route.from} → ${route.to}.`,
          entityId: route.id,
          metadata: {
            routeKey: route.routeKey,
            previousMultiplier:
              route.activeMultiplier,
            newMultiplier,
            previousStatus: route.status,
            newStatus,
            ridesUpdated: matchingRides.length,
          },
        });

        setSelectedRoute((current) =>
          current?.id === route.id
            ? {
                ...current,
                activeMultiplier: newMultiplier,
                status: newStatus,
                paused,
                automaticApplied: false,
              }
            : current,
        );

        setMessage(
          `${route.from} → ${route.to} updated to ${newMultiplier.toFixed(
            2,
          )}x across ${matchingRides.length} ride${
            matchingRides.length === 1 ? "" : "s"
          }.`,
        );
      } catch (error) {
        console.error(
          "Update surge route failed:",
          error,
        );

        setErrorMessage(
          "RoadLink could not update surge pricing for this route.",
        );
      } finally {
        setUpdatingRouteId(null);
      }
    },
    [
      createAuditLog,
      createSurgeEvent,
      rules,
    ],
  );

  const filteredRoutes = useMemo(() => {
    const search = normalizeString(searchTerm);

    return routes.filter((routeItem) => {
      const matchesSearch =
        !search ||
        normalizeString(
          `${routeItem.from} ${routeItem.to} ${routeItem.routeKey}`,
        ).includes(search);

      const matchesStatus =
        statusFilter === "all" ||
        routeItem.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [routes, searchTerm, statusFilter]);

  const metrics = useMemo(() => {
    const activeRoutes = routes.filter(
      (routeItem) =>
        routeItem.status === "active",
    ).length;

    const criticalRoutes = routes.filter(
      (routeItem) =>
        routeItem.status === "critical",
    ).length;

    const pausedRoutes = routes.filter(
      (routeItem) => routeItem.paused,
    ).length;

    const averageMultiplier =
      routes.length > 0
        ? routes.reduce(
            (total, routeItem) =>
              total +
              safeNumber(
                routeItem.activeMultiplier,
              ),
            0,
          ) / routes.length
        : 1;

    const averagePressure =
      routes.length > 0
        ? routes.reduce(
            (total, routeItem) =>
              total +
              safeNumber(routeItem.pressureScore),
            0,
          ) / routes.length
        : 0;

    const projectedRevenueLift = routes.reduce(
      (total, routeItem) =>
        total +
        safeNumber(
          routeItem.projectedRevenueLift,
        ),
      0,
    );

    return {
      activeRoutes,
      criticalRoutes,
      pausedRoutes,
      averageMultiplier,
      averagePressure,
      projectedRevenueLift,
    };
  }, [routes]);

  const topPressureRoutes = useMemo(
    () =>
      [...routes]
        .sort(
          (first, second) =>
            second.pressureScore -
            first.pressureScore,
        )
        .slice(0, 6),
    [routes],
  );

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-12%] top-[-14%] h-[34rem] w-[34rem] rounded-full bg-orange-500/10 blur-[150px]" />
        <div className="absolute right-[-10%] top-[12%] h-[32rem] w-[32rem] rounded-full bg-emerald-500/[0.08] blur-[160px]" />
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

              <Link
                href="/admin/ai-pricing"
                className="transition hover:text-emerald-300"
              >
                AI Pricing
              </Link>

              <span>/</span>

              <span className="text-slate-300">
                Dynamic Surge Pricing
              </span>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-orange-400/20 bg-orange-400/10">
                <Flame className="h-7 w-7 text-orange-300" />
              </div>

              <div>
                <h1 className="text-2xl font-black sm:text-4xl">
                  Dynamic Surge Pricing
                </h1>

                <p className="mt-1 max-w-3xl text-sm text-slate-400 sm:text-base">
                  Real-time demand, supply and booking
                  pressure control for every RoadLink route.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="rounded-2xl border border-white/[0.07] bg-slate-950/60 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                Surge Engine
              </p>

              <div className="mt-1 flex items-center gap-2 text-sm font-black text-emerald-300">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </span>

                {rules.enabled
                  ? rules.automaticMode
                    ? "Automatic mode"
                    : "Manual mode"
                  : "Engine paused"}
              </div>
            </div>

            <button
              type="button"
              onClick={runSurgeEngine}
              disabled={
                runningEngine || !rules.enabled
              }
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-black text-slate-950 shadow-xl shadow-orange-500/20 transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {runningEngine ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Sparkles className="h-5 w-5" />
              )}

              {runningEngine
                ? "Calculating Surge"
                : "Run Surge Engine"}
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
              <p className="font-black">
                {errorMessage
                  ? "Surge Pricing Alert"
                  : runningEngine
                    ? "Marketplace analysis running"
                    : "Surge intelligence updated"}
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
            title="Revenue Lift"
            value={formatCurrency(
              metrics.projectedRevenueLift,
            )}
            subtitle="Projected surge opportunity"
            icon={
              <CircleDollarSign className="h-6 w-6" />
            }
            tone="green"
          />

          <MetricCard
            title="Active Surge"
            value={metrics.activeRoutes}
            subtitle={`${metrics.criticalRoutes} critical routes`}
            icon={<Flame className="h-6 w-6" />}
            tone={
              metrics.criticalRoutes > 0
                ? "red"
                : "amber"
            }
          />

          <MetricCard
            title="Average Multiplier"
            value={`${metrics.averageMultiplier.toFixed(
              2,
            )}x`}
            subtitle="Active route multiplier"
            icon={<TrendingUp className="h-6 w-6" />}
            tone="purple"
          />

          <MetricCard
            title="Market Pressure"
            value={`${Math.round(
              metrics.averagePressure,
            )}%`}
            subtitle="Average demand pressure"
            icon={<Gauge className="h-6 w-6" />}
            tone={
              metrics.averagePressure >= 70
                ? "red"
                : metrics.averagePressure >= 50
                  ? "amber"
                  : "green"
            }
          />

          <MetricCard
            title="Paused Routes"
            value={metrics.pausedRoutes}
            subtitle="Excluded from surge changes"
            icon={<Pause className="h-6 w-6" />}
            tone="cyan"
          />
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.48fr]">
          <article className="overflow-hidden rounded-[2rem] border border-white/[0.07] bg-slate-950/60 shadow-2xl shadow-black/25 backdrop-blur-2xl">
            <div className="border-b border-white/[0.06] p-5 sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-xl font-black">
                    <Route className="h-5 w-5 text-orange-300" />
                    Live surge routes
                  </h2>

                  <p className="mt-2 text-sm text-slate-500">
                    Route pressure, current multipliers and
                    AI recommendations.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm("");
                    setStatusFilter("all");
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm font-black text-slate-300"
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
                    placeholder="Search route..."
                    className="h-12 w-full rounded-2xl border border-white/[0.08] bg-slate-900/70 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-orange-400/40"
                  />
                </label>

                <label className="relative">
                  <SlidersHorizontal className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

                  <select
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(
                        event.target.value as SurgeFilter,
                      )
                    }
                    className="h-12 min-w-44 appearance-none rounded-2xl border border-white/[0.08] bg-slate-900/70 pl-10 pr-10 text-sm font-black text-slate-300 outline-none"
                  >
                    <option value="all">All status</option>
                    <option value="critical">
                      Critical
                    </option>
                    <option value="active">Active</option>
                    <option value="watch">Watch</option>
                    <option value="normal">Normal</option>
                    <option value="paused">Paused</option>
                  </select>

                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </label>
              </div>
            </div>

            <div className="max-h-[1050px] overflow-y-auto">
              {loading ? (
                <div className="flex min-h-96 flex-col items-center justify-center">
                  <Loader2 className="h-10 w-10 animate-spin text-orange-300" />

                  <p className="mt-4 font-black text-slate-300">
                    Loading surge intelligence...
                  </p>
                </div>
              ) : filteredRoutes.length === 0 ? (
                <div className="flex min-h-96 flex-col items-center justify-center px-6 text-center">
                  <Flame className="h-12 w-12 text-orange-300" />

                  <p className="mt-4 text-lg font-black">
                    No surge route data
                  </p>

                  <p className="mt-2 max-w-md text-sm text-slate-500">
                    Run the Dynamic Surge Engine to
                    calculate route pressure and
                    multipliers.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.05]">
                  {filteredRoutes.map((routeItem) => (
                    <button
                      key={routeItem.id}
                      type="button"
                      onClick={() =>
                        setSelectedRoute(routeItem)
                      }
                      className="group w-full p-5 text-left transition hover:bg-white/[0.025] sm:p-6"
                    >
                      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap gap-2">
                            <span
                              className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
                                STATUS_STYLES[
                                  routeItem.status
                                ]
                              }`}
                            >
                              {
                                STATUS_LABELS[
                                  routeItem.status
                                ]
                              }
                            </span>

                            <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-orange-300">
                              {routeItem.activeMultiplier.toFixed(
                                2,
                              )}
                              x active
                            </span>

                            <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-violet-300">
                              {routeItem.recommendedMultiplier.toFixed(
                                2,
                              )}
                              x recommended
                            </span>

                            {routeItem.automaticApplied && (
                              <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-300">
                                Automatic
                              </span>
                            )}
                          </div>

                          <div className="mt-3 flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-orange-500/15 bg-orange-500/10">
                              <MapPin className="h-5 w-5 text-orange-300" />
                            </div>

                            <div className="min-w-0">
                              <h3 className="truncate text-base font-black group-hover:text-orange-300 sm:text-lg">
                                {routeItem.from}{" "}
                                <ArrowRight className="mx-1 inline h-4 w-4" />{" "}
                                {routeItem.to}
                              </h3>

                              <p className="mt-1 text-xs text-slate-500">
                                {
                                  routeItem.averageDistanceMiles
                                }{" "}
                                miles · {routeItem.activeRides}{" "}
                                active rides ·{" "}
                                {routeItem.availableSeats} seats
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-3 sm:grid-cols-4">
                            <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
                              <p className="text-[10px] font-black uppercase text-slate-600">
                                Demand
                              </p>

                              <p className="mt-1 text-lg font-black">
                                {routeItem.demandScore}
                              </p>
                            </div>

                            <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
                              <p className="text-[10px] font-black uppercase text-slate-600">
                                Supply
                              </p>

                              <p className="mt-1 text-lg font-black">
                                {routeItem.supplyScore}
                              </p>
                            </div>

                            <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
                              <p className="text-[10px] font-black uppercase text-slate-600">
                                Last hour
                              </p>

                              <p className="mt-1 text-lg font-black">
                                {
                                  routeItem.bookingsLastHour
                                }
                              </p>
                            </div>

                            <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
                              <p className="text-[10px] font-black uppercase text-slate-600">
                                Pressure
                              </p>

                              <p
                                className={`mt-1 text-lg font-black ${
                                  routeItem.pressureScore >=
                                  75
                                    ? "text-red-300"
                                    : routeItem.pressureScore >=
                                        50
                                      ? "text-amber-300"
                                      : "text-emerald-300"
                                }`}
                              >
                                {routeItem.pressureScore}%
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0">
                          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                            Recommended price
                          </p>

                          <p className="mt-1 text-3xl font-black text-orange-300">
                            {formatCurrency(
                              routeItem.recommendedPrice,
                            )}
                          </p>

                          <div className="mt-2">
                            <MultiplierChange
                              current={
                                routeItem.activeMultiplier
                              }
                              recommended={
                                routeItem.recommendedMultiplier
                              }
                            />
                          </div>

                          <p className="mt-3 text-xs text-slate-500">
                            Revenue lift
                          </p>

                          <p className="mt-1 text-lg font-black text-emerald-300">
                            {formatCurrency(
                              routeItem.projectedRevenueLift,
                            )}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </article>

          <aside className="space-y-6">
            <article className="rounded-[2rem] border border-white/[0.07] bg-slate-950/60 p-5 shadow-2xl shadow-black/25 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black">
                    Surge controls
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Global pricing configuration
                  </p>
                </div>

                <Settings2 className="h-6 w-6 text-orange-300" />
              </div>

              <div className="mt-5 space-y-3">
                <div className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
                  <div>
                    <p className="text-sm font-black">
                      Surge Engine
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Enable dynamic calculations
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      updateRule(
                        "enabled",
                        !rules.enabled,
                      )
                    }
                    className={`relative h-7 w-14 rounded-full ${
                      rules.enabled
                        ? "bg-emerald-500"
                        : "bg-slate-700"
                    }`}
                    aria-label="Toggle surge engine"
                  >
                    <span
                      className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
                        rules.enabled
                          ? "left-8"
                          : "left-1"
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
                  <div>
                    <p className="text-sm font-black">
                      Automatic Mode
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Apply eligible multipliers
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      updateRule(
                        "automaticMode",
                        !rules.automaticMode,
                      )
                    }
                    className={`relative h-7 w-14 rounded-full ${
                      rules.automaticMode
                        ? "bg-orange-500"
                        : "bg-slate-700"
                    }`}
                    aria-label="Toggle automatic mode"
                  >
                    <span
                      className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
                        rules.automaticMode
                          ? "left-8"
                          : "left-1"
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                {[
                  {
                    label: "Minimum multiplier",
                    key: "minimumMultiplier" as const,
                    value: rules.minimumMultiplier,
                    step: "0.05",
                  },
                  {
                    label: "Maximum multiplier",
                    key: "maximumMultiplier" as const,
                    value: rules.maximumMultiplier,
                    step: "0.05",
                  },
                  {
                    label: "Activation demand",
                    key: "activationDemandScore" as const,
                    value:
                      rules.activationDemandScore,
                    step: "1",
                  },
                  {
                    label: "Critical demand",
                    key: "criticalDemandScore" as const,
                    value:
                      rules.criticalDemandScore,
                    step: "1",
                  },
                  {
                    label: "Minimum supply",
                    key: "minimumSupplyScore" as const,
                    value: rules.minimumSupplyScore,
                    step: "1",
                  },
                  {
                    label: "Cooldown minutes",
                    key: "cooldownMinutes" as const,
                    value: rules.cooldownMinutes,
                    step: "1",
                  },
                ].map((field) => (
                  <label key={field.key}>
                    <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                      {field.label}
                    </span>

                    <input
                      type="number"
                      min="0"
                      step={field.step}
                      value={field.value}
                      onChange={(event) =>
                        updateRule(
                          field.key,
                          safeNumber(
                            event.target.value,
                          ),
                        )
                      }
                      className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-slate-900/70 px-3 text-sm text-white outline-none focus:border-orange-400/40"
                    />
                  </label>
                ))}
              </div>

              <div className="mt-5 space-y-4">
                {[
                  {
                    label: "Demand weight",
                    key: "demandWeight" as const,
                    value: rules.demandWeight,
                  },
                  {
                    label: "Supply weight",
                    key: "supplyWeight" as const,
                    value: rules.supplyWeight,
                  },
                  {
                    label: "Booking velocity",
                    key: "velocityWeight" as const,
                    value: rules.velocityWeight,
                  },
                  {
                    label: "Cancellation weight",
                    key: "cancellationWeight" as const,
                    value: rules.cancellationWeight,
                  },
                ].map((field) => (
                  <div key={field.key}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                        {field.label}
                      </span>

                      <span className="text-xs font-black">
                        {field.value}%
                      </span>
                    </div>

                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={field.value}
                      onChange={(event) =>
                        updateRule(
                          field.key,
                          safeNumber(
                            event.target.value,
                          ),
                        )
                      }
                      className="mt-2 w-full accent-orange-500"
                    />
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={saveRules}
                disabled={savingRules}
                className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 text-sm font-black text-slate-950 disabled:opacity-50"
              >
                {savingRules ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}

                Save surge rules
              </button>
            </article>

            <article className="rounded-[2rem] border border-white/[0.07] bg-slate-950/60 p-5 shadow-2xl shadow-black/25 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black">
                    Highest pressure
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Routes closest to critical surge
                  </p>
                </div>

                <BarChart3 className="h-6 w-6 text-violet-300" />
              </div>

              <div className="mt-5 space-y-3">
                {topPressureRoutes.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/[0.08] p-6 text-center">
                    <Target className="mx-auto h-8 w-8 text-orange-300" />

                    <p className="mt-3 text-sm font-black text-slate-300">
                      No pressure data calculated
                    </p>
                  </div>
                ) : (
                  topPressureRoutes.map(
                    (routeItem, index) => (
                      <button
                        key={routeItem.id}
                        type="button"
                        onClick={() =>
                          setSelectedRoute(routeItem)
                        }
                        className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3 text-left"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-sm font-black">
                          {index + 1}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-black">
                            {routeItem.from} →{" "}
                            {routeItem.to}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {routeItem.recommendedMultiplier.toFixed(
                              2,
                            )}
                            x recommended
                          </p>
                        </div>

                        <p
                          className={`text-sm font-black ${
                            routeItem.pressureScore >=
                            75
                              ? "text-red-300"
                              : routeItem.pressureScore >=
                                  50
                                ? "text-amber-300"
                                : "text-emerald-300"
                          }`}
                        >
                          {routeItem.pressureScore}%
                        </p>
                      </button>
                    ),
                  )
                )}
              </div>
            </article>

            <article className="rounded-[2rem] border border-white/[0.07] bg-slate-950/60 p-5 shadow-2xl shadow-black/25 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black">
                    Surge timeline
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Latest multiplier actions
                  </p>
                </div>

                <History className="h-6 w-6 text-cyan-300" />
              </div>

              <div className="mt-5 space-y-4">
                {events.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/[0.08] p-5 text-center text-sm text-slate-500">
                    Surge history will appear after the
                    first route action.
                  </div>
                ) : (
                  events.slice(0, 8).map((event) => (
                    <div
                      key={event.id}
                      className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black">
                            {event.from || "Unknown"} →{" "}
                            {event.to || "Unknown"}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {event.reason ||
                              event.action ||
                              "Surge update"}
                          </p>
                        </div>

                        <span className="shrink-0 text-xs font-black text-orange-300">
                          {safeNumber(
                            event.newMultiplier,
                          ).toFixed(2)}
                          x
                        </span>
                      </div>

                      <p className="mt-2 text-[11px] font-bold text-slate-600">
                        {formatRelative(event.createdAt)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </article>
          </aside>
        </section>
      </div>

      {selectedRoute && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-md sm:items-center sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-label="Surge route details"
        >
          <button
            type="button"
            onClick={() => setSelectedRoute(null)}
            className="absolute inset-0"
            aria-label="Close surge details"
          />

          <div className="relative z-10 max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-t-[2rem] border border-white/[0.08] bg-[#030712] shadow-2xl shadow-black sm:rounded-[2rem]">
            <div className="sticky top-0 z-20 flex items-center justify-between border-b border-white/[0.06] bg-[#030712]/95 p-5 sm:p-6">
              <div className="min-w-0">
                <div className="flex flex-wrap gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
                      STATUS_STYLES[
                        selectedRoute.status
                      ]
                    }`}
                  >
                    {
                      STATUS_LABELS[
                        selectedRoute.status
                      ]
                    }
                  </span>

                  <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-orange-300">
                    {selectedRoute.activeMultiplier.toFixed(
                      2,
                    )}
                    x active
                  </span>

                  <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-violet-300">
                    {selectedRoute.confidence}% confidence
                  </span>
                </div>

                <h2 className="mt-3 truncate text-xl font-black sm:text-2xl">
                  {selectedRoute.from} →{" "}
                  {selectedRoute.to}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setSelectedRoute(null)}
                className="ml-4 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-slate-400"
                aria-label="Close surge route"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 sm:p-7">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  title="Active Multiplier"
                  value={`${selectedRoute.activeMultiplier.toFixed(
                    2,
                  )}x`}
                  subtitle="Current route multiplier"
                  icon={<Flame className="h-6 w-6" />}
                  tone="amber"
                />

                <MetricCard
                  title="Recommended"
                  value={`${selectedRoute.recommendedMultiplier.toFixed(
                    2,
                  )}x`}
                  subtitle="AI surge recommendation"
                  icon={
                    <BrainCircuit className="h-6 w-6" />
                  }
                  tone="purple"
                />

                <MetricCard
                  title="Recommended Price"
                  value={formatCurrency(
                    selectedRoute.recommendedPrice,
                  )}
                  subtitle="Projected route price"
                  icon={
                    <WalletCards className="h-6 w-6" />
                  }
                  tone="cyan"
                />

                <MetricCard
                  title="Revenue Lift"
                  value={formatCurrency(
                    selectedRoute.projectedRevenueLift,
                  )}
                  subtitle="Estimated opportunity"
                  icon={
                    <TrendingUp className="h-6 w-6" />
                  }
                  tone="green"
                />
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.85fr]">
                <div className="space-y-5">
                  <div className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-5">
                    <h3 className="flex items-center gap-2 font-black">
                      <Sparkles className="h-5 w-5 text-orange-300" />
                      Surge recommendation
                    </h3>

                    <p className="mt-4 text-sm leading-7 text-slate-300">
                      {selectedRoute.recommendation}
                    </p>

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-white/[0.05] bg-slate-950/50 p-4">
                        <p className="text-xs font-black uppercase text-slate-600">
                          Base price
                        </p>

                        <p className="mt-2 text-xl font-black">
                          {formatCurrency(
                            selectedRoute.averagePrice,
                          )}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-orange-500/15 bg-orange-500/[0.06] p-4">
                        <p className="text-xs font-black uppercase text-orange-400">
                          Target
                        </p>

                        <p className="mt-2 text-xl font-black text-orange-300">
                          {formatCurrency(
                            selectedRoute.recommendedPrice,
                          )}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-white/[0.05] bg-slate-950/50 p-4">
                        <p className="text-xs font-black uppercase text-slate-600">
                          Difference
                        </p>

                        <p className="mt-2 text-xl font-black text-emerald-300">
                          {formatCurrency(
                            selectedRoute.recommendedPrice -
                              selectedRoute.averagePrice,
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-5">
                    <h3 className="flex items-center gap-2 font-black">
                      <Activity className="h-5 w-5 text-cyan-300" />
                      Marketplace pressure
                    </h3>

                    <div className="mt-5 space-y-5">
                      <ScoreBar
                        label="Demand"
                        value={
                          selectedRoute.demandScore
                        }
                      />

                      <ScoreBar
                        label="Supply"
                        value={
                          selectedRoute.supplyScore
                        }
                        inverse
                      />

                      <ScoreBar
                        label="Booking velocity"
                        value={
                          selectedRoute.velocityScore
                        }
                      />

                      <ScoreBar
                        label="Cancellation pressure"
                        value={
                          selectedRoute.cancellationScore
                        }
                      />

                      <ScoreBar
                        label="Combined pressure"
                        value={
                          selectedRoute.pressureScore
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-5">
                    <h3 className="flex items-center gap-2 font-black">
                      <Route className="h-5 w-5 text-violet-300" />
                      Route intelligence
                    </h3>

                    <dl className="mt-5 space-y-4">
                      {[
                        [
                          "Distance",
                          `${selectedRoute.averageDistanceMiles} miles`,
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
                          "Total bookings",
                          selectedRoute.bookings,
                        ],
                        [
                          "Recent bookings",
                          selectedRoute.recentBookings,
                        ],
                        [
                          "Bookings last hour",
                          selectedRoute.bookingsLastHour,
                        ],
                        [
                          "Available seats",
                          selectedRoute.availableSeats,
                        ],
                        [
                          "Seats booked",
                          selectedRoute.seatsBooked,
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
                    <h3 className="flex items-center gap-2 font-black">
                      <ShieldCheck className="h-5 w-5 text-emerald-300" />
                      Surge controls
                    </h3>

                    <p className="mt-3 text-sm leading-6 text-slate-500">
                      Every action updates matching rides
                      and generates an audit log.
                    </p>

                    <div className="mt-5 grid gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          updateRouteSurge({
                            route: selectedRoute,
                            action: "activate",
                          })
                        }
                        disabled={
                          updatingRouteId ===
                          selectedRoute.id
                        }
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 text-sm font-black text-slate-950 disabled:opacity-50"
                      >
                        {updatingRouteId ===
                        selectedRoute.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Flame className="h-4 w-4" />
                        )}

                        Activate{" "}
                        {selectedRoute.recommendedMultiplier.toFixed(
                          2,
                        )}
                        x surge
                      </button>

                      {selectedRoute.paused ? (
                        <button
                          type="button"
                          onClick={() =>
                            updateRouteSurge({
                              route: selectedRoute,
                              action: "resume",
                            })
                          }
                          disabled={
                            updatingRouteId ===
                            selectedRoute.id
                          }
                          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 text-sm font-black text-cyan-200 disabled:opacity-50"
                        >
                          <Play className="h-4 w-4" />
                          Resume surge monitoring
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            updateRouteSurge({
                              route: selectedRoute,
                              action: "pause",
                            })
                          }
                          disabled={
                            updatingRouteId ===
                            selectedRoute.id
                          }
                          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 text-sm font-black text-amber-200 disabled:opacity-50"
                        >
                          <Pause className="h-4 w-4" />
                          Pause this route
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          updateRouteSurge({
                            route: selectedRoute,
                            action: "deactivate",
                          })
                        }
                        disabled={
                          updatingRouteId ===
                          selectedRoute.id
                        }
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-500/20 bg-slate-500/10 px-4 text-sm font-black text-slate-300 disabled:opacity-50"
                      >
                        <TrendingDown className="h-4 w-4" />
                        Return to 1.00x
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-4">
                      <Clock3 className="h-5 w-5 text-cyan-300" />

                      <p className="mt-3 text-xs font-black uppercase text-slate-600">
                        Cooldown
                      </p>

                      <p className="mt-1 text-sm font-black">
                        {rules.cooldownMinutes} min
                      </p>
                    </div>

                    <div className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-4">
                      <UsersRound className="h-5 w-5 text-violet-300" />

                      <p className="mt-3 text-xs font-black uppercase text-slate-600">
                        Mode
                      </p>

                      <p className="mt-1 text-sm font-black">
                        {rules.automaticMode
                          ? "Automatic"
                          : "Manual"}
                      </p>
                    </div>

                    <div className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-4">
                      <Zap className="h-5 w-5 text-orange-300" />

                      <p className="mt-3 text-xs font-black uppercase text-slate-600">
                        Maximum
                      </p>

                      <p className="mt-1 text-sm font-black">
                        {rules.maximumMultiplier.toFixed(
                          2,
                        )}
                        x
                      </p>
                    </div>

                    <div className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-4">
                      <Eye className="h-5 w-5 text-emerald-300" />

                      <p className="mt-3 text-xs font-black uppercase text-slate-600">
                        Confidence
                      </p>

                      <p className="mt-1 text-sm font-black">
                        {selectedRoute.confidence}%
                      </p>
                    </div>
                  </div>

                  {selectedRoute.activeMultiplier > 1 && (
                    <div className="rounded-3xl border border-orange-500/15 bg-orange-500/[0.06] p-5">
                      <p className="flex items-center gap-2 text-sm font-black text-orange-300">
                        <CheckCircle2 className="h-4 w-4" />
                        Surge pricing active
                      </p>

                      <p className="mt-2 text-xs leading-5 text-orange-100/70">
                        Current multiplier:{" "}
                        {selectedRoute.activeMultiplier.toFixed(
                          2,
                        )}
                        x.{" "}
                        {selectedRoute.automaticApplied
                          ? "Applied automatically by the surge engine."
                          : "Applied manually by an administrator."}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
  }
