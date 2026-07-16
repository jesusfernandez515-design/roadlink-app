"use client";

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
  where,
  writeBatch,
} from "firebase/firestore";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Eye,
  FileSearch,
  Filter,
  Fingerprint,
  Gauge,
  Loader2,
  LockKeyhole,
  RefreshCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Sparkles,
  TrendingDown,
  TriangleAlert,
  UserRoundSearch,
  UsersRound,
  WalletCards,
  XCircle,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { auth, db } from "@/lib/firebase";

type Severity = "critical" | "high" | "medium" | "low";
type FraudStatus =
  | "open"
  | "investigating"
  | "monitoring"
  | "resolved"
  | "dismissed";

type TimestampLike =
  | {
      seconds?: number;
      nanoseconds?: number;
      toDate?: () => Date;
    }
  | string
  | number
  | Date
  | null
  | undefined;

type UserItem = {
  id: string;
  email?: string;
  name?: string;
  phone?: string;
  role?: string;
  status?: string;
  driverVerified?: boolean;
  isVerified?: boolean;
  verified?: boolean;
  verificationStatus?: string;
  createdAt?: TimestampLike;
  updatedAt?: TimestampLike;
  deviceId?: string;
  deviceFingerprint?: string;
  ipAddress?: string;
  payoutAccount?: string;
  bankAccountLast4?: string;
  stripeAccountId?: string;
  avatarUrl?: string;
};

type RideItem = {
  id: string;
  driverId?: string;
  driverEmail?: string;
  from?: string;
  to?: string;
  status?: string;
  price?: number;
  seats?: number;
  availableSeats?: number;
  createdAt?: TimestampLike;
  updatedAt?: TimestampLike;
  date?: TimestampLike;
};

type BookingItem = {
  id: string;
  rideId?: string;
  passengerId?: string;
  passengerEmail?: string;
  driverId?: string;
  driverEmail?: string;
  status?: string;
  price?: number;
  amount?: number;
  seatsBooked?: number;
  paymentStatus?: string;
  createdAt?: TimestampLike;
  updatedAt?: TimestampLike;
};

type ReportItem = {
  id: string;
  reporterId?: string;
  reporterEmail?: string;
  reportedUserId?: string;
  reportedUserEmail?: string;
  targetUserId?: string;
  targetEmail?: string;
  reason?: string;
  type?: string;
  status?: string;
  severity?: string;
  createdAt?: TimestampLike;
};

type WalletItem = {
  id: string;
  userId?: string;
  email?: string;
  balance?: number;
  availableBalance?: number;
  pendingBalance?: number;
  totalEarned?: number;
  totalWithdrawn?: number;
  suspicious?: boolean;
  status?: string;
  updatedAt?: TimestampLike;
  createdAt?: TimestampLike;
};

type PayoutItem = {
  id: string;
  userId?: string;
  driverId?: string;
  email?: string;
  driverEmail?: string;
  amount?: number;
  status?: string;
  paymentMethod?: string;
  payoutAccount?: string;
  createdAt?: TimestampLike;
  updatedAt?: TimestampLike;
};

type FraudCase = {
  id: string;
  entityId?: string;
  entityType?: string;
  userId?: string;
  userEmail?: string;
  type: string;
  severity: Severity;
  confidence: number;
  fraudScore: number;
  riskScore: number;
  description: string;
  recommendation: string;
  evidence?: string[];
  status: FraudStatus;
  createdAt?: TimestampLike;
  updatedAt?: TimestampLike;
  resolved: boolean;
  resolvedAt?: TimestampLike;
  resolvedBy?: string;
  createdBy: string;
  source?: string;
};

type DetectionResult = Omit<
  FraudCase,
  "createdAt" | "updatedAt" | "resolvedAt"
>;

type FilterSeverity = "all" | Severity;
type FilterStatus = "all" | FraudStatus;

const COLLECTION_LIMIT = 1500;

const severityOrder: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const statusLabels: Record<FraudStatus, string> = {
  open: "Open",
  investigating: "Investigating",
  monitoring: "Monitoring",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

const statusStyles: Record<FraudStatus, string> = {
  open: "border-red-500/25 bg-red-500/10 text-red-300",
  investigating: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  monitoring: "border-cyan-500/25 bg-cyan-500/10 text-cyan-300",
  resolved: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  dismissed: "border-slate-500/25 bg-slate-500/10 text-slate-300",
};

const severityStyles: Record<Severity, string> = {
  critical: "border-red-500/30 bg-red-500/10 text-red-300",
  high: "border-orange-500/30 bg-orange-500/10 text-orange-300",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  low: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
};

const typeLabels: Record<string, string> = {
  duplicate_identity: "Duplicate identity",
  multiple_accounts: "Multiple accounts",
  bot_activity: "Bot activity",
  excessive_reports: "Excessive reports",
  suspicious_cancellations: "Suspicious cancellations",
  payout_velocity: "Payout velocity",
  suspicious_payment: "Suspicious payment",
  fake_driver: "Fake driver",
  fake_booking: "Fake booking",
  wallet_anomaly: "Wallet anomaly",
};

function normalizeString(value?: string | null) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function normalizePhone(value?: string | null) {
  return String(value ?? "").replace(/\D/g, "");
}

function normalizeStatus(value?: string | null) {
  return normalizeString(value).replace(/\s+/g, "_");
}

function safeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function toDate(value: TimestampLike): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number" || typeof value === "string") {
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

  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);

  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);

  if (days < 30) return `${days}d ago`;

  return formatDate(value);
}

function isWithinDays(value: TimestampLike, days: number) {
  const timestamp = getTime(value);

  if (!timestamp) return false;

  return timestamp >= Date.now() - days * 24 * 60 * 60 * 1000;
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function getUserIdentifier(item: {
  userId?: string;
  driverId?: string;
  passengerId?: string;
  email?: string;
  driverEmail?: string;
  passengerEmail?: string;
}) {
  return (
    item.userId ||
    item.driverId ||
    item.passengerId ||
    normalizeString(item.email) ||
    normalizeString(item.driverEmail) ||
    normalizeString(item.passengerEmail)
  );
}

function createCaseId(type: string, entityId: string) {
  const safeEntity = entityId
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);

  return `${type}_${safeEntity}`;
}

function resolveSeverity(score: number): Severity {
  if (score >= 88) return "critical";
  if (score >= 72) return "high";
  if (score >= 50) return "medium";
  return "low";
}

function buildDetection(
  input: Omit<
    DetectionResult,
    "severity" | "resolved" | "createdBy" | "status"
  > & {
    severity?: Severity;
  },
): DetectionResult {
  const fraudScore = clamp(input.fraudScore);
  const riskScore = clamp(input.riskScore);
  const severity =
    input.severity ?? resolveSeverity(Math.max(fraudScore, riskScore));

  return {
    ...input,
    fraudScore,
    riskScore,
    confidence: clamp(input.confidence),
    severity,
    resolved: false,
    status: "open",
    createdBy: "ai-fraud-detection-engine",
    source: "ai-fraud-detection-center",
  };
}

function buildFraudDetections({
  users,
  rides,
  bookings,
  reports,
  wallets,
  payouts,
}: {
  users: UserItem[];
  rides: RideItem[];
  bookings: BookingItem[];
  reports: ReportItem[];
  wallets: WalletItem[];
  payouts: PayoutItem[];
}) {
  const detections: DetectionResult[] = [];
  const userById = new Map(users.map((user) => [user.id, user]));

  const userByEmail = new Map<string, UserItem[]>();
  const userByPhone = new Map<string, UserItem[]>();
  const userByDevice = new Map<string, UserItem[]>();
  const userByIp = new Map<string, UserItem[]>();
  const userByPayoutAccount = new Map<string, UserItem[]>();

  for (const user of users) {
    const email = normalizeString(user.email);
    const phone = normalizePhone(user.phone);
    const device = normalizeString(
      user.deviceFingerprint || user.deviceId,
    );
    const ip = normalizeString(user.ipAddress);
    const payoutAccount = normalizeString(
      user.payoutAccount ||
        user.stripeAccountId ||
        user.bankAccountLast4,
    );

    if (email) {
      userByEmail.set(email, [...(userByEmail.get(email) ?? []), user]);
    }

    if (phone.length >= 7) {
      userByPhone.set(phone, [...(userByPhone.get(phone) ?? []), user]);
    }

    if (device) {
      userByDevice.set(device, [
        ...(userByDevice.get(device) ?? []),
        user,
      ]);
    }

    if (ip) {
      userByIp.set(ip, [...(userByIp.get(ip) ?? []), user]);
    }

    if (payoutAccount) {
      userByPayoutAccount.set(payoutAccount, [
        ...(userByPayoutAccount.get(payoutAccount) ?? []),
        user,
      ]);
    }
  }

  const duplicateGroups = [
    ...Array.from(userByEmail.entries()).map(([value, matches]) => ({
      field: "email",
      value,
      matches,
    })),
    ...Array.from(userByPhone.entries()).map(([value, matches]) => ({
      field: "phone",
      value,
      matches,
    })),
  ].filter((group) => group.matches.length > 1);

  for (const group of duplicateGroups) {
    const ids = unique(group.matches.map((item) => item.id));
    const confidence = group.field === "email" ? 97 : 91;
    const fraudScore = clamp(65 + ids.length * 8);
    const riskScore = clamp(58 + ids.length * 9);
    const entityId = `${group.field}-${group.value}`;

    detections.push(
      buildDetection({
        id: createCaseId("duplicate_identity", entityId),
        entityId,
        entityType: "user_group",
        userId: ids[0],
        userEmail: group.matches[0]?.email,
        type: "duplicate_identity",
        confidence,
        fraudScore,
        riskScore,
        description: `${ids.length} user accounts share the same ${group.field}. This may indicate duplicate registration, identity reuse or account farming.`,
        recommendation:
          "Review identity records, recent login activity and verification documents. Restrict payouts until ownership is confirmed.",
        evidence: [
          `Shared ${group.field}: ${group.value}`,
          `Accounts: ${ids.join(", ")}`,
        ],
      }),
    );
  }

  const linkedAccountGroups = [
    ...Array.from(userByDevice.entries()).map(([value, matches]) => ({
      field: "device fingerprint",
      value,
      matches,
    })),
    ...Array.from(userByIp.entries()).map(([value, matches]) => ({
      field: "IP address",
      value,
      matches,
    })),
    ...Array.from(userByPayoutAccount.entries()).map(
      ([value, matches]) => ({
        field: "payout account",
        value,
        matches,
      }),
    ),
  ].filter((group) => group.matches.length >= 3);

  for (const group of linkedAccountGroups) {
    const ids = unique(group.matches.map((item) => item.id));
    const isPayout = group.field === "payout account";
    const confidence = clamp(
      75 + ids.length * 4 + (isPayout ? 8 : 0),
    );
    const fraudScore = clamp(
      62 + ids.length * 6 + (isPayout ? 10 : 0),
    );
    const riskScore = clamp(
      60 + ids.length * 7 + (isPayout ? 8 : 0),
    );
    const entityId = `${group.field}-${group.value}`;

    detections.push(
      buildDetection({
        id: createCaseId("multiple_accounts", entityId),
        entityId,
        entityType: "user_group",
        userId: ids[0],
        userEmail: group.matches[0]?.email,
        type: "multiple_accounts",
        confidence,
        fraudScore,
        riskScore,
        description: `${ids.length} accounts are connected through the same ${group.field}. This pattern may indicate coordinated multi-account activity.`,
        recommendation:
          "Require step-up verification, compare payment methods and suspend high-risk transactions while the relationship is investigated.",
        evidence: [
          `Shared ${group.field}: ${group.value}`,
          `Linked accounts: ${ids.join(", ")}`,
        ],
      }),
    );
  }

  const recentUsersByDevice = new Map<string, UserItem[]>();

  for (const user of users.filter((item) =>
    isWithinDays(item.createdAt, 7),
  )) {
    const key = normalizeString(
      user.deviceFingerprint || user.deviceId || user.ipAddress,
    );

    if (!key) continue;

    recentUsersByDevice.set(key, [
      ...(recentUsersByDevice.get(key) ?? []),
      user,
    ]);
  }

  for (const [device, matches] of recentUsersByDevice.entries()) {
    if (matches.length < 4) continue;

    const ids = matches.map((item) => item.id);
    const score = clamp(65 + matches.length * 6);

    detections.push(
      buildDetection({
        id: createCaseId("bot_activity", device),
        entityId: device,
        entityType: "device_cluster",
        userId: ids[0],
        userEmail: matches[0]?.email,
        type: "bot_activity",
        confidence: clamp(74 + matches.length * 4),
        fraudScore: score,
        riskScore: clamp(score + 4),
        description: `${matches.length} new accounts were created from the same device or network signal during the last seven days.`,
        recommendation:
          "Apply CAPTCHA, device challenge and rate limits. Review login velocity before allowing bookings or payouts.",
        evidence: [
          `Device/network cluster: ${device}`,
          `New accounts: ${ids.join(", ")}`,
        ],
      }),
    );
  }

  const reportsByTarget = new Map<string, ReportItem[]>();

  for (const report of reports) {
    const target =
      report.reportedUserId ||
      report.targetUserId ||
      normalizeString(report.reportedUserEmail) ||
      normalizeString(report.targetEmail);

    if (!target) continue;

    reportsByTarget.set(target, [
      ...(reportsByTarget.get(target) ?? []),
      report,
    ]);
  }

  for (const [target, userReports] of reportsByTarget.entries()) {
    const recentReports = userReports.filter((report) =>
      isWithinDays(report.createdAt, 30),
    );

    if (recentReports.length < 3) continue;

    const uniqueReporters = unique(
      recentReports
        .map(
          (report) =>
            report.reporterId || normalizeString(report.reporterEmail),
        )
        .filter(Boolean),
    );

    const fraudScore = clamp(48 + recentReports.length * 6);
    const riskScore = clamp(
      55 + recentReports.length * 6 + uniqueReporters.length * 2,
    );
    const user = userById.get(target);

    detections.push(
      buildDetection({
        id: createCaseId("excessive_reports", target),
        entityId: target,
        entityType: "user",
        userId: target,
        userEmail:
          user?.email ||
          recentReports[0]?.reportedUserEmail ||
          recentReports[0]?.targetEmail,
        type: "excessive_reports",
        confidence: clamp(
          62 + recentReports.length * 5 + uniqueReporters.length * 3,
        ),
        fraudScore,
        riskScore,
        description: `${recentReports.length} reports from ${uniqueReporters.length || 1} distinct reporters were linked to this account during the last thirty days.`,
        recommendation:
          "Review report reasons, message history and completed rides. Consider temporary restrictions if safety-related reports are substantiated.",
        evidence: [
          `Recent reports: ${recentReports.length}`,
          `Unique reporters: ${uniqueReporters.length}`,
          ...unique(
            recentReports
              .map((report) => report.reason || report.type)
              .filter(Boolean),
          ).slice(0, 5),
        ],
      }),
    );
  }

  const bookingsByUser = new Map<string, BookingItem[]>();

  for (const booking of bookings) {
    const userKey =
      booking.passengerId || normalizeString(booking.passengerEmail);

    if (!userKey) continue;

    bookingsByUser.set(userKey, [
      ...(bookingsByUser.get(userKey) ?? []),
      booking,
    ]);
  }

  for (const [userKey, userBookings] of bookingsByUser.entries()) {
    const recentBookings = userBookings.filter((booking) =>
      isWithinDays(booking.createdAt, 30),
    );

    if (recentBookings.length < 5) continue;

    const cancelled = recentBookings.filter((booking) =>
      [
        "cancelled",
        "canceled",
        "rejected",
        "no_show",
        "failed",
      ].includes(normalizeStatus(booking.status)),
    );

    const cancellationRate =
      recentBookings.length > 0
        ? cancelled.length / recentBookings.length
        : 0;

    if (cancelled.length < 4 || cancellationRate < 0.6) continue;

    const user = userById.get(userKey);
    const score = clamp(
      55 + cancellationRate * 30 + cancelled.length * 2,
    );

    detections.push(
      buildDetection({
        id: createCaseId("suspicious_cancellations", userKey),
        entityId: userKey,
        entityType: "user",
        userId: userKey,
        userEmail: user?.email || recentBookings[0]?.passengerEmail,
        type: "suspicious_cancellations",
        confidence: clamp(
          64 + cancellationRate * 24 + recentBookings.length,
        ),
        fraudScore: score,
        riskScore: clamp(score + 3),
        description: `${cancelled.length} of ${recentBookings.length} recent bookings were cancelled, rejected or marked as no-show.`,
        recommendation:
          "Inspect cancellation timing, promo usage and linked payment methods. Apply booking limits if abuse is confirmed.",
        evidence: [
          `Cancellation rate: ${Math.round(cancellationRate * 100)}%`,
          `Cancelled bookings: ${cancelled.length}`,
          `Total recent bookings: ${recentBookings.length}`,
        ],
      }),
    );
  }

  const ridesByDriver = new Map<string, RideItem[]>();

  for (const ride of rides) {
    const driver =
      ride.driverId || normalizeString(ride.driverEmail);

    if (!driver) continue;

    ridesByDriver.set(driver, [
      ...(ridesByDriver.get(driver) ?? []),
      ride,
    ]);
  }

  for (const [driverKey, driverRides] of ridesByDriver.entries()) {
    const recentRides = driverRides.filter((ride) =>
      isWithinDays(ride.createdAt, 30),
    );

    if (recentRides.length < 5) continue;

    const cancelled = recentRides.filter((ride) =>
      ["cancelled", "canceled", "failed"].includes(
        normalizeStatus(ride.status),
      ),
    );

    const cancellationRate = cancelled.length / recentRides.length;

    if (cancelled.length < 4 || cancellationRate < 0.55) continue;

    const user = userById.get(driverKey);
    const score = clamp(
      54 + cancellationRate * 30 + cancelled.length * 2,
    );

    detections.push(
      buildDetection({
        id: createCaseId(
          "suspicious_cancellations",
          `driver-${driverKey}`,
        ),
        entityId: driverKey,
        entityType: "driver",
        userId: driverKey,
        userEmail: user?.email || recentRides[0]?.driverEmail,
        type: "suspicious_cancellations",
        confidence: clamp(66 + cancellationRate * 26),
        fraudScore: score,
        riskScore: clamp(score + 5),
        description: `Driver activity shows ${cancelled.length} cancelled rides out of ${recentRides.length} recent listings.`,
        recommendation:
          "Review route publication patterns, passenger complaints and payout behavior before allowing additional high-value rides.",
        evidence: [
          `Driver cancellation rate: ${Math.round(cancellationRate * 100)}%`,
          `Cancelled rides: ${cancelled.length}`,
          `Recent rides: ${recentRides.length}`,
        ],
      }),
    );
  }

  const payoutsByUser = new Map<string, PayoutItem[]>();

  for (const payout of payouts) {
    const userKey =
      payout.userId ||
      payout.driverId ||
      normalizeString(payout.email) ||
      normalizeString(payout.driverEmail);

    if (!userKey) continue;

    payoutsByUser.set(userKey, [
      ...(payoutsByUser.get(userKey) ?? []),
      payout,
    ]);
  }

  for (const [userKey, userPayouts] of payoutsByUser.entries()) {
    const lastSevenDays = userPayouts.filter((payout) =>
      isWithinDays(payout.createdAt, 7),
    );
    const lastTwentyFourHours = userPayouts.filter((payout) =>
      isWithinDays(payout.createdAt, 1),
    );
    const totalSevenDays = lastSevenDays.reduce(
      (sum, payout) => sum + safeNumber(payout.amount),
      0,
    );
    const totalTwentyFourHours = lastTwentyFourHours.reduce(
      (sum, payout) => sum + safeNumber(payout.amount),
      0,
    );

    const excessiveFrequency =
      lastSevenDays.length >= 5 || lastTwentyFourHours.length >= 3;
    const excessiveValue =
      totalSevenDays >= 2500 || totalTwentyFourHours >= 1200;

    if (!excessiveFrequency && !excessiveValue) continue;

    const user = userById.get(userKey);
    const score = clamp(
      55 +
        lastSevenDays.length * 4 +
        Math.min(totalSevenDays / 100, 25) +
        lastTwentyFourHours.length * 5,
    );

    detections.push(
      buildDetection({
        id: createCaseId("payout_velocity", userKey),
        entityId: userKey,
        entityType: "user",
        userId: userKey,
        userEmail:
          user?.email ||
          lastSevenDays[0]?.email ||
          lastSevenDays[0]?.driverEmail,
        type: "payout_velocity",
        confidence: clamp(
          68 +
            lastSevenDays.length * 3 +
            lastTwentyFourHours.length * 4,
        ),
        fraudScore: score,
        riskScore: clamp(score + 7),
        description: `${lastSevenDays.length} payout requests totaling $${totalSevenDays.toFixed(
          2,
        )} were submitted during the last seven days.`,
        recommendation:
          "Place pending payouts on manual review. Validate completed rides, payout ownership and payment settlement status.",
        evidence: [
          `Payouts in seven days: ${lastSevenDays.length}`,
          `Seven-day amount: $${totalSevenDays.toFixed(2)}`,
          `Twenty-four-hour amount: $${totalTwentyFourHours.toFixed(2)}`,
        ],
      }),
    );
  }

  for (const wallet of wallets) {
    const userKey =
      wallet.userId || normalizeString(wallet.email) || wallet.id;
    const balance = safeNumber(
      wallet.balance ?? wallet.availableBalance,
    );
    const pendingBalance = safeNumber(wallet.pendingBalance);
    const totalEarned = safeNumber(wallet.totalEarned);
    const totalWithdrawn = safeNumber(wallet.totalWithdrawn);

    const impossibleBalance =
      balance < -1 ||
      pendingBalance < -1 ||
      totalWithdrawn > totalEarned + 100;
    const markedSuspicious =
      wallet.suspicious === true ||
      ["blocked", "suspicious", "frozen"].includes(
        normalizeStatus(wallet.status),
      );
    const unusuallyLargeBalance =
      balance >= 5000 && totalEarned > 0 && balance > totalEarned * 1.25;

    if (
      !impossibleBalance &&
      !markedSuspicious &&
      !unusuallyLargeBalance
    ) {
      continue;
    }

    const user = userById.get(userKey);
    const score = clamp(
      62 +
        (impossibleBalance ? 18 : 0) +
        (markedSuspicious ? 15 : 0) +
        (unusuallyLargeBalance ? 12 : 0),
    );

    detections.push(
      buildDetection({
        id: createCaseId("wallet_anomaly", userKey),
        entityId: wallet.id,
        entityType: "wallet",
        userId: userKey,
        userEmail: user?.email || wallet.email,
        type: "wallet_anomaly",
        confidence: clamp(score + 2),
        fraudScore: score,
        riskScore: clamp(score + 5),
        description:
          "Wallet balances or withdrawal totals are inconsistent with recorded earnings or account status.",
        recommendation:
          "Freeze outbound transfers and reconcile booking revenue, refunds and completed payouts before restoring wallet access.",
        evidence: [
          `Available balance: $${balance.toFixed(2)}`,
          `Pending balance: $${pendingBalance.toFixed(2)}`,
          `Total earned: $${totalEarned.toFixed(2)}`,
          `Total withdrawn: $${totalWithdrawn.toFixed(2)}`,
        ],
      }),
    );
  }

  const bookingsByRide = new Map<string, BookingItem[]>();

  for (const booking of bookings) {
    if (!booking.rideId) continue;

    bookingsByRide.set(booking.rideId, [
      ...(bookingsByRide.get(booking.rideId) ?? []),
      booking,
    ]);
  }

  for (const [rideId, rideBookings] of bookingsByRide.entries()) {
    const passengerKeys = rideBookings
      .map(
        (booking) =>
          booking.passengerId ||
          normalizeString(booking.passengerEmail),
      )
      .filter(Boolean);

    const uniquePassengers = unique(passengerKeys);
    const repeatedPassengers =
      rideBookings.length - uniquePassengers.length;
    const rapidBookings = rideBookings.filter((booking) =>
      isWithinDays(booking.createdAt, 1),
    );
    const totalSeats = rideBookings.reduce(
      (sum, booking) => sum + Math.max(safeNumber(booking.seatsBooked), 1),
      0,
    );
    const ride = rides.find((item) => item.id === rideId);
    const rideCapacity = Math.max(
      safeNumber(ride?.seats),
      safeNumber(ride?.availableSeats),
    );

    const overbooked =
      rideCapacity > 0 && totalSeats > rideCapacity + 2;
    const duplicateBookingPattern = repeatedPassengers >= 2;
    const velocityPattern = rapidBookings.length >= 8;

    if (
      !overbooked &&
      !duplicateBookingPattern &&
      !velocityPattern
    ) {
      continue;
    }

    const score = clamp(
      55 +
        (overbooked ? 18 : 0) +
        repeatedPassengers * 5 +
        rapidBookings.length * 2,
    );

    detections.push(
      buildDetection({
        id: createCaseId("fake_booking", rideId),
        entityId: rideId,
        entityType: "ride",
        userId: ride?.driverId,
        userEmail: ride?.driverEmail,
        type: "fake_booking",
        confidence: clamp(score),
        fraudScore: score,
        riskScore: clamp(score + 4),
        description:
          "This ride contains booking patterns associated with reservation farming, duplicate passengers or artificial demand.",
        recommendation:
          "Review passenger accounts, payment settlement and device relationships. Cancel unpaid duplicates and restrict promotional credits.",
        evidence: [
          `Bookings: ${rideBookings.length}`,
          `Unique passengers: ${uniquePassengers.length}`,
          `Booked seats: ${totalSeats}`,
          `Ride capacity: ${rideCapacity || "Unknown"}`,
        ],
      }),
    );
  }

  for (const booking of bookings) {
    const amount = safeNumber(booking.amount ?? booking.price);
    const paymentStatus = normalizeStatus(booking.paymentStatus);
    const bookingStatus = normalizeStatus(booking.status);

    const completedWithoutPayment =
      ["completed", "confirmed"].includes(bookingStatus) &&
      ["failed", "refunded", "chargeback", "unpaid"].includes(
        paymentStatus,
      );
    const unusuallyLargeBooking = amount >= 750;
    const zeroValueConfirmed =
      amount <= 0 &&
      ["confirmed", "completed"].includes(bookingStatus);

    if (
      !completedWithoutPayment &&
      !unusuallyLargeBooking &&
      !zeroValueConfirmed
    ) {
      continue;
    }

    const userKey =
      booking.passengerId ||
      normalizeString(booking.passengerEmail) ||
      booking.id;
    const score = clamp(
      58 +
        (completedWithoutPayment ? 18 : 0) +
        (unusuallyLargeBooking ? 14 : 0) +
        (zeroValueConfirmed ? 15 : 0),
    );

    detections.push(
      buildDetection({
        id: createCaseId("suspicious_payment", booking.id),
        entityId: booking.id,
        entityType: "booking",
        userId: userKey,
        userEmail: booking.passengerEmail,
        type: "suspicious_payment",
        confidence: clamp(score + 3),
        fraudScore: score,
        riskScore: clamp(score + 5),
        description:
          "Booking payment information is inconsistent with the reservation amount or completion status.",
        recommendation:
          "Verify the payment provider transaction, chargeback status and passenger identity before releasing driver funds.",
        evidence: [
          `Booking status: ${booking.status || "Unknown"}`,
          `Payment status: ${booking.paymentStatus || "Unknown"}`,
          `Amount: $${amount.toFixed(2)}`,
          `Ride ID: ${booking.rideId || "Unknown"}`,
        ],
      }),
    );
  }

  for (const user of users) {
    const isDriver =
      normalizeStatus(user.role) === "driver" ||
      rides.some(
        (ride) =>
          ride.driverId === user.id ||
          normalizeString(ride.driverEmail) ===
            normalizeString(user.email),
      );

    if (!isDriver) continue;

    const verified =
      user.driverVerified === true ||
      user.isVerified === true ||
      user.verified === true ||
      ["approved", "verified", "active"].includes(
        normalizeStatus(user.verificationStatus),
      );

    const driverRides =
      ridesByDriver.get(user.id) ??
      ridesByDriver.get(normalizeString(user.email)) ??
      [];
    const driverPayouts =
      payoutsByUser.get(user.id) ??
      payoutsByUser.get(normalizeString(user.email)) ??
      [];
    const completedRides = driverRides.filter((ride) =>
      ["completed", "finished"].includes(normalizeStatus(ride.status)),
    );
    const payoutTotal = driverPayouts.reduce(
      (sum, payout) => sum + safeNumber(payout.amount),
      0,
    );

    const highActivityUnverified =
      !verified &&
      (completedRides.length >= 3 ||
        driverPayouts.length >= 2 ||
        payoutTotal >= 500);

    if (!highActivityUnverified) continue;

    const score = clamp(
      62 +
        completedRides.length * 4 +
        driverPayouts.length * 5 +
        Math.min(payoutTotal / 100, 15),
    );

    detections.push(
      buildDetection({
        id: createCaseId("fake_driver", user.id),
        entityId: user.id,
        entityType: "driver",
        userId: user.id,
        userEmail: user.email,
        type: "fake_driver",
        confidence: clamp(score),
        fraudScore: score,
        riskScore: clamp(score + 8),
        description:
          "An unverified driver account has completed rides or initiated payout activity beyond the expected verification threshold.",
        recommendation:
          "Suspend ride publishing and payouts until driver identity, license, insurance and vehicle documents are approved.",
        evidence: [
          `Completed rides: ${completedRides.length}`,
          `Payout requests: ${driverPayouts.length}`,
          `Payout total: $${payoutTotal.toFixed(2)}`,
          `Verification status: ${user.verificationStatus || "Not verified"}`,
        ],
      }),
    );
  }

  return detections
    .filter(
      (item, index, array) =>
        array.findIndex((candidate) => candidate.id === item.id) ===
        index,
    )
    .sort((a, b) => {
      const severityDifference =
        severityOrder[b.severity] - severityOrder[a.severity];

      if (severityDifference !== 0) return severityDifference;

      return b.riskScore - a.riskScore;
    });
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

function ScoreRing({
  score,
  label,
  size = "large",
}: {
  score: number;
  label: string;
  size?: "large" | "small";
}) {
  const radius = size === "large" ? 54 : 32;
  const stroke = size === "large" ? 10 : 7;
  const dimension = size === "large" ? 140 : 88;
  const circumference = 2 * Math.PI * radius;
  const progress = circumference - (score / 100) * circumference;
  const center = dimension / 2;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={dimension}
        height={dimension}
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(148,163,184,0.12)"
          strokeWidth={stroke}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={progress}
          className={
            score >= 80
              ? "text-red-400"
              : score >= 60
                ? "text-orange-400"
                : score >= 40
                  ? "text-amber-400"
                  : "text-emerald-400"
          }
        />
      </svg>

      <div className="absolute flex flex-col items-center justify-center">
        <span
          className={
            size === "large"
              ? "text-3xl font-black text-white"
              : "text-lg font-black text-white"
          }
        >
          {score}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
          {label}
        </span>
      </div>
    </div>
  );
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
  icon: React.ReactNode;
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
    <div className="group relative overflow-hidden rounded-3xl border border-white/[0.07] bg-slate-950/55 p-5 shadow-2xl shadow-black/20 backdrop-blur-2xl transition duration-300 hover:-translate-y-1 hover:border-white/[0.12]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
            {title}
          </p>
          <p className="mt-3 text-3xl font-black tracking-tight text-white">
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
    </div>
  );
}

function MiniBarChart({
  data,
}: {
  data: Array<{ label: string; value: number }>;
}) {
  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="flex h-56 items-end gap-3">
      {data.map((item) => {
        const height =
          item.value === 0 ? 4 : Math.max((item.value / max) * 100, 8);

        return (
          <div
            key={item.label}
            className="flex min-w-0 flex-1 flex-col items-center gap-3"
          >
            <span className="text-xs font-bold text-slate-300">
              {item.value}
            </span>

            <div className="flex h-36 w-full items-end rounded-2xl border border-white/[0.05] bg-white/[0.02] p-1.5">
              <div
                className="w-full rounded-xl bg-gradient-to-t from-emerald-500/50 via-emerald-400/75 to-cyan-300 shadow-lg shadow-emerald-500/20 transition-all duration-500"
                style={{ height: `${height}%` }}
              />
            </div>

            <span className="max-w-full truncate text-center text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function RiskDistribution({
  critical,
  high,
  medium,
  low,
}: {
  critical: number;
  high: number;
  medium: number;
  low: number;
}) {
  const total = critical + high + medium + low || 1;
  const segments = [
    {
      label: "Critical",
      value: critical,
      width: (critical / total) * 100,
      className: "bg-red-500",
    },
    {
      label: "High",
      value: high,
      width: (high / total) * 100,
      className: "bg-orange-500",
    },
    {
      label: "Medium",
      value: medium,
      width: (medium / total) * 100,
      className: "bg-amber-400",
    },
    {
      label: "Low",
      value: low,
      width: (low / total) * 100,
      className: "bg-cyan-400",
    },
  ];

  return (
    <div>
      <div className="flex h-4 overflow-hidden rounded-full bg-white/[0.04]">
        {segments.map((segment) =>
          segment.width > 0 ? (
            <div
              key={segment.label}
              className={`${segment.className} transition-all duration-500`}
              style={{ width: `${segment.width}%` }}
            />
          ) : null,
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {segments.map((segment) => (
          <div
            key={segment.label}
            className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3"
          >
            <div className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${segment.className}`}
              />
              <span className="text-xs font-semibold text-slate-400">
                {segment.label}
              </span>
            </div>
            <p className="mt-2 text-xl font-black text-white">
              {segment.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AiFraudDetectionPage() {
  const [fraudCases, setFraudCases] = useState<FraudCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningScan, setRunningScan] = useState(false);
  const [updatingCaseId, setUpdatingCaseId] = useState<string | null>(
    null,
  );
  const [selectedCase, setSelectedCase] = useState<FraudCase | null>(
    null,
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [severityFilter, setSeverityFilter] =
    useState<FilterSeverity>("all");
  const [statusFilter, setStatusFilter] =
    useState<FilterStatus>("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [lastScanAt, setLastScanAt] = useState<Date | null>(null);
  const [scanMessage, setScanMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const casesQuery = query(
      collection(db, "fraudCases"),
      orderBy("createdAt", "desc"),
      limit(500),
    );

    const unsubscribe = onSnapshot(
      casesQuery,
      (snapshot) => {
        const items = snapshot.docs.map(
          (document) =>
            ({
              id: document.id,
              ...document.data(),
            }) as FraudCase,
        );

        setFraudCases(items);
        setLoading(false);
      },
      (error) => {
        console.error("Fraud cases listener failed:", error);
        setErrorMessage(
          "RoadLink could not load the fraud case stream. Check Firestore permissions and indexes.",
        );
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  const createNotification = useCallback(
    async ({
      title,
      message,
      type,
      severity,
      entityId,
    }: {
      title: string;
      message: string;
      type: string;
      severity: Severity;
      entityId?: string;
    }) => {
      const notificationRef = doc(collection(db, "notifications"));

      await setDoc(notificationRef, {
        id: notificationRef.id,
        title,
        message,
        type,
        severity,
        audience: "admin",
        entityId: entityId ?? null,
        read: false,
        createdAt: serverTimestamp(),
        createdBy:
          auth.currentUser?.email || "ai-fraud-detection-engine",
      });
    },
    [],
  );

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
      const auditRef = doc(collection(db, "auditLogs"));

      await setDoc(auditRef, {
        id: auditRef.id,
        module: "ai-fraud-detection",
        action,
        description,
        entityId: entityId ?? null,
        metadata: metadata ?? {},
        actorId: auth.currentUser?.uid || "system",
        actorEmail:
          auth.currentUser?.email ||
          "ai-fraud-detection-engine@roadlink.system",
        createdAt: serverTimestamp(),
      });
    },
    [],
  );

  const runFraudScan = useCallback(async () => {
    setRunningScan(true);
    setErrorMessage("");
    setScanMessage("Loading RoadLink marketplace signals...");

    try {
      const [
        users,
        rides,
        bookings,
        reports,
        wallets,
        payouts,
      ] = await Promise.all([
        fetchCollection<UserItem>("users"),
        fetchCollection<RideItem>("rides"),
        fetchCollection<BookingItem>("bookings"),
        fetchCollection<ReportItem>("reports"),
        fetchCollection<WalletItem>("wallet"),
        fetchCollection<PayoutItem>("payoutRequests"),
      ]);

      setScanMessage("Analyzing identities, payments and behavior...");

      const detections = buildFraudDetections({
        users,
        rides,
        bookings,
        reports,
        wallets,
        payouts,
      });

      const existingSnapshot = await getDocs(
        query(
          collection(db, "fraudCases"),
          where("resolved", "==", false),
          limit(1000),
        ),
      );

      const existingCases = new Map(
        existingSnapshot.docs.map((document) => [
          document.id,
          document.data() as FraudCase,
        ]),
      );

      const batch = writeBatch(db);
      let newCriticalCases = 0;
      let newCases = 0;
      let updatedCases = 0;

      for (const detection of detections) {
        const caseRef = doc(db, "fraudCases", detection.id);
        const existing = existingCases.get(detection.id);

        if (existing) {
          batch.set(
            caseRef,
            {
              ...detection,
              id: detection.id,
              status: existing.status || "open",
              resolved: existing.resolved ?? false,
              createdAt: existing.createdAt || serverTimestamp(),
              updatedAt: serverTimestamp(),
              lastDetectedAt: serverTimestamp(),
              detectionCount:
                safeNumber(
                  (existing as FraudCase & {
                    detectionCount?: number;
                  }).detectionCount,
                ) + 1,
            },
            { merge: true },
          );
          updatedCases += 1;
        } else {
          batch.set(caseRef, {
            ...detection,
            id: detection.id,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            lastDetectedAt: serverTimestamp(),
            detectionCount: 1,
          });
          newCases += 1;

          if (detection.severity === "critical") {
            newCriticalCases += 1;
          }
        }
      }

      await batch.commit();

      await createAuditLog({
        action: "AI_FRAUD_SCAN_COMPLETED",
        description: `AI Fraud Detection completed with ${detections.length} risk signals.`,
        metadata: {
          usersAnalyzed: users.length,
          ridesAnalyzed: rides.length,
          bookingsAnalyzed: bookings.length,
          reportsAnalyzed: reports.length,
          walletsAnalyzed: wallets.length,
          payoutsAnalyzed: payouts.length,
          detections: detections.length,
          newCases,
          updatedCases,
          newCriticalCases,
        },
      });

      if (newCriticalCases > 0) {
        await createNotification({
          title: "Critical fraud risks detected",
          message: `${newCriticalCases} new critical fraud case${
            newCriticalCases === 1 ? "" : "s"
          } require immediate review.`,
          type: "fraud_alert",
          severity: "critical",
        });
      } else if (newCases > 0) {
        await createNotification({
          title: "Fraud scan completed",
          message: `${newCases} new fraud case${
            newCases === 1 ? "" : "s"
          } were created for administrative review.`,
          type: "fraud_scan",
          severity: "medium",
        });
      }

      setLastScanAt(new Date());
      setScanMessage(
        `${detections.length} signals analyzed · ${newCases} new cases · ${updatedCases} refreshed`,
      );
    } catch (error) {
      console.error("AI fraud scan failed:", error);
      setErrorMessage(
        "The fraud scan could not be completed. Verify collection permissions and Firestore connectivity.",
      );
      setScanMessage("");
    } finally {
      setRunningScan(false);
    }
  }, [createAuditLog, createNotification]);

  const updateCaseStatus = useCallback(
    async (fraudCase: FraudCase, status: FraudStatus) => {
      setUpdatingCaseId(fraudCase.id);
      setErrorMessage("");

      try {
        const resolved = ["resolved", "dismissed"].includes(status);

        await updateDoc(doc(db, "fraudCases", fraudCase.id), {
          status,
          resolved,
          resolvedAt: resolved ? serverTimestamp() : null,
          resolvedBy: resolved
            ? auth.currentUser?.email || "RoadLink Admin"
            : null,
          updatedAt: serverTimestamp(),
        });

        await createAuditLog({
          action: "FRAUD_CASE_STATUS_UPDATED",
          description: `Fraud case ${fraudCase.id} changed to ${status}.`,
          entityId: fraudCase.id,
          metadata: {
            previousStatus: fraudCase.status,
            newStatus: status,
            type: fraudCase.type,
            severity: fraudCase.severity,
            riskScore: fraudCase.riskScore,
          },
        });

        if (status === "investigating") {
          await createNotification({
            title: "Fraud investigation started",
            message: `${typeLabels[fraudCase.type] || fraudCase.type} is now under investigation.`,
            type: "fraud_investigation",
            severity: fraudCase.severity,
            entityId: fraudCase.id,
          });
        }

        setSelectedCase((current) =>
          current?.id === fraudCase.id
            ? {
                ...current,
                status,
                resolved,
              }
            : current,
        );
      } catch (error) {
        console.error("Failed to update fraud case:", error);
        setErrorMessage(
          "RoadLink could not update this fraud case. Check your Firestore write permissions.",
        );
      } finally {
        setUpdatingCaseId(null);
      }
    },
    [createAuditLog, createNotification],
  );

  const activeCases = useMemo(
    () => fraudCases.filter((item) => !item.resolved),
    [fraudCases],
  );

  const metrics = useMemo(() => {
    const critical = activeCases.filter(
      (item) => item.severity === "critical",
    ).length;
    const high = activeCases.filter(
      (item) => item.severity === "high",
    ).length;
    const medium = activeCases.filter(
      (item) => item.severity === "medium",
    ).length;
    const low = activeCases.filter(
      (item) => item.severity === "low",
    ).length;
    const open = activeCases.filter(
      (item) => item.status === "open",
    ).length;
    const investigating = activeCases.filter(
      (item) => item.status === "investigating",
    ).length;
    const resolved = fraudCases.filter(
      (item) => item.resolved,
    ).length;
    const averageRisk =
      activeCases.length > 0
        ? Math.round(
            activeCases.reduce(
              (sum, item) => sum + safeNumber(item.riskScore),
              0,
            ) / activeCases.length,
          )
        : 0;
    const averageFraud =
      activeCases.length > 0
        ? Math.round(
            activeCases.reduce(
              (sum, item) => sum + safeNumber(item.fraudScore),
              0,
            ) / activeCases.length,
          )
        : 0;
    const exposureScore = clamp(
      averageRisk * 0.55 +
        averageFraud * 0.3 +
        Math.min(critical * 7, 15),
    );

    return {
      critical,
      high,
      medium,
      low,
      open,
      investigating,
      resolved,
      averageRisk,
      averageFraud,
      exposureScore,
    };
  }, [activeCases, fraudCases]);

  const fraudTypes = useMemo(
    () =>
      unique(fraudCases.map((item) => item.type))
        .filter(Boolean)
        .sort(),
    [fraudCases],
  );

  const filteredCases = useMemo(() => {
    const normalizedSearch = normalizeString(searchTerm);

    return fraudCases
      .filter((item) => {
        const matchesSearch =
          !normalizedSearch ||
          [
            item.id,
            item.type,
            item.description,
            item.recommendation,
            item.userEmail,
            item.userId,
            item.entityId,
          ]
            .map((value) => normalizeString(value))
            .some((value) => value.includes(normalizedSearch));

        const matchesSeverity =
          severityFilter === "all" ||
          item.severity === severityFilter;

        const matchesStatus =
          statusFilter === "all" || item.status === statusFilter;

        const matchesType =
          typeFilter === "all" || item.type === typeFilter;

        return (
          matchesSearch &&
          matchesSeverity &&
          matchesStatus &&
          matchesType
        );
      })
      .sort((a, b) => {
        if (a.resolved !== b.resolved) {
          return a.resolved ? 1 : -1;
        }

        const severityDifference =
          severityOrder[b.severity] -
          severityOrder[a.severity];

        if (severityDifference !== 0) {
          return severityDifference;
        }

        return (
          safeNumber(b.riskScore) - safeNumber(a.riskScore)
        );
      });
  }, [
    fraudCases,
    searchTerm,
    severityFilter,
    statusFilter,
    typeFilter,
  ]);

  const topRisks = useMemo(
    () =>
      [...activeCases]
        .sort(
          (a, b) =>
            safeNumber(b.riskScore) - safeNumber(a.riskScore),
        )
        .slice(0, 6),
    [activeCases],
  );

  const typeChartData = useMemo(() => {
    const counts = new Map<string, number>();

    for (const item of activeCases) {
      counts.set(item.type, (counts.get(item.type) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([type, value]) => ({
        label:
          typeLabels[type]?.replace("Suspicious ", "") ||
          type.replaceAll("_", " "),
        value,
      }));
  }, [activeCases]);

  const timeline = useMemo(
    () =>
      [...fraudCases]
        .sort(
          (a, b) =>
            getTime(b.updatedAt || b.createdAt) -
            getTime(a.updatedAt || a.createdAt),
        )
        .slice(0, 8),
    [fraudCases],
  );

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-10%] top-[-12%] h-[34rem] w-[34rem] rounded-full bg-emerald-500/10 blur-[150px]" />
        <div className="absolute right-[-8%] top-[14%] h-[30rem] w-[30rem] rounded-full bg-cyan-500/8 blur-[150px]" />
        <div className="absolute bottom-[-20%] left-[32%] h-[38rem] w-[38rem] rounded-full bg-violet-500/7 blur-[180px]" />
      </div>

      <div className="relative mx-auto w-full max-w-[1800px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
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
                AI Fraud Detection
              </span>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 shadow-xl shadow-emerald-500/10">
                <Fingerprint className="h-7 w-7 text-emerald-300" />
              </div>

              <div>
                <h1 className="text-2xl font-black tracking-tight sm:text-4xl">
                  AI Fraud Detection Center
                </h1>
                <p className="mt-1 max-w-3xl text-sm text-slate-400 sm:text-base">
                  Enterprise risk intelligence for identities,
                  bookings, payouts, wallets and marketplace behavior.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="rounded-2xl border border-white/[0.07] bg-slate-950/55 px-4 py-3 backdrop-blur-2xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Detection Engine
              </p>
              <div className="mt-1 flex items-center gap-2 text-sm font-bold text-emerald-300">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </span>
                Live protection active
              </div>
            </div>

            <button
              type="button"
              onClick={runFraudScan}
              disabled={runningScan}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-slate-950 shadow-xl shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {runningScan ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Sparkles className="h-5 w-5" />
              )}
              {runningScan ? "Running AI Scan" : "Run Fraud Scan"}
            </button>
          </div>
        </div>

        {(errorMessage || scanMessage) && (
          <div
            className={`mb-6 flex items-start gap-3 rounded-2xl border p-4 ${
              errorMessage
                ? "border-red-500/20 bg-red-500/10 text-red-200"
                : "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
            }`}
          >
            {errorMessage ? (
              <AlertOctagon className="mt-0.5 h-5 w-5 shrink-0" />
            ) : (
              <Activity className="mt-0.5 h-5 w-5 shrink-0" />
            )}

            <div className="min-w-0">
              <p className="font-bold">
                {errorMessage
                  ? "Fraud Detection Alert"
                  : runningScan
                    ? "AI engine processing"
                    : "Scan completed"}
              </p>
              <p className="mt-1 text-sm opacity-80">
                {errorMessage || scanMessage}
                {lastScanAt && !runningScan
                  ? ` · ${formatRelative(lastScanAt)}`
                  : ""}
              </p>
            </div>
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            title="Marketplace Exposure"
            value={`${metrics.exposureScore}%`}
            subtitle="Composite fraud and risk exposure"
            icon={<Gauge className="h-6 w-6" />}
            tone={
              metrics.exposureScore >= 70
                ? "red"
                : metrics.exposureScore >= 45
                  ? "amber"
                  : "green"
            }
          />

          <MetricCard
            title="Critical Cases"
            value={metrics.critical}
            subtitle="Require immediate intervention"
            icon={<Siren className="h-6 w-6" />}
            tone="red"
          />

          <MetricCard
            title="Open Investigations"
            value={metrics.investigating}
            subtitle={`${metrics.open} additional cases awaiting review`}
            icon={<FileSearch className="h-6 w-6" />}
            tone="amber"
          />

          <MetricCard
            title="Average Risk Score"
            value={metrics.averageRisk}
            subtitle="Across all active fraud cases"
            icon={<ShieldAlert className="h-6 w-6" />}
            tone="purple"
          />

          <MetricCard
            title="Resolved Cases"
            value={metrics.resolved}
            subtitle="Closed or dismissed investigations"
            icon={<ShieldCheck className="h-6 w-6" />}
            tone="green"
          />
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="relative overflow-hidden rounded-[2rem] border border-white/[0.07] bg-slate-950/55 p-5 shadow-2xl shadow-black/25 backdrop-blur-2xl sm:p-7">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />

            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-emerald-300" />
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">
                    RoadLink Risk Intelligence
                  </p>
                </div>

                <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
                  Marketplace fraud posture
                </h2>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                  The AI engine combines identity duplication,
                  behavioral velocity, cancellation ratios, wallet
                  anomalies, report concentration and payout exposure.
                </p>
              </div>

              <div className="flex items-center justify-center gap-4 sm:gap-8">
                <ScoreRing
                  score={metrics.averageFraud}
                  label="Fraud"
                />
                <ScoreRing
                  score={metrics.averageRisk}
                  label="Risk"
                />
              </div>
            </div>

            <div className="mt-8">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white">
                    Active risk distribution
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Severity across unresolved cases
                  </p>
                </div>

                <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs font-bold text-slate-300">
                  {activeCases.length} active
                </span>
              </div>

              <RiskDistribution
                critical={metrics.critical}
                high={metrics.high}
                medium={metrics.medium}
                low={metrics.low}
              />
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[2rem] border border-white/[0.07] bg-slate-950/55 p-5 shadow-2xl shadow-black/25 backdrop-blur-2xl sm:p-7">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />

            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">
                  Detection categories
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Most frequent active risk signals
                </p>
              </div>

              <TrendingDown className="h-6 w-6 text-cyan-300" />
            </div>

            {typeChartData.length > 0 ? (
              <MiniBarChart data={typeChartData} />
            ) : (
              <div className="flex h-56 flex-col items-center justify-center text-center">
                <ShieldCheck className="h-10 w-10 text-emerald-300" />
                <p className="mt-4 font-bold text-white">
                  No active risk signals
                </p>
                <p className="mt-2 max-w-sm text-sm text-slate-500">
                  Run the AI fraud scan to analyze current
                  marketplace activity.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.62fr]">
          <div className="overflow-hidden rounded-[2rem] border border-white/[0.07] bg-slate-950/55 shadow-2xl shadow-black/25 backdrop-blur-2xl">
            <div className="border-b border-white/[0.06] p-5 sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5 text-red-300" />
                    <h2 className="text-xl font-black">
                      Fraud case command center
                    </h2>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    Review, investigate, monitor and resolve AI
                    generated risk cases.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm("");
                    setSeverityFilter("all");
                    setStatusFilter("all");
                    setTypeFilter("all");
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm font-bold text-slate-300 transition hover:border-white/[0.14] hover:bg-white/[0.07]"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Reset filters
                </button>
              </div>

              <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto_auto_auto]">
                <label className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={(event) =>
                      setSearchTerm(event.target.value)
                    }
                    placeholder="Search case, user, email or description..."
                    className="h-12 w-full rounded-2xl border border-white/[0.08] bg-slate-900/70 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-400/40 focus:ring-4 focus:ring-emerald-500/5"
                  />
                </label>

                <label className="relative">
                  <Filter className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <select
                    value={severityFilter}
                    onChange={(event) =>
                      setSeverityFilter(
                        event.target.value as FilterSeverity,
                      )
                    }
                    className="h-12 min-w-40 appearance-none rounded-2xl border border-white/[0.08] bg-slate-900/70 pl-10 pr-10 text-sm font-semibold text-slate-300 outline-none"
                  >
                    <option value="all">All severity</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </label>

                <label className="relative">
                  <select
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(
                        event.target.value as FilterStatus,
                      )
                    }
                    className="h-12 min-w-44 appearance-none rounded-2xl border border-white/[0.08] bg-slate-900/70 px-4 pr-10 text-sm font-semibold text-slate-300 outline-none"
                  >
                    <option value="all">All status</option>
                    <option value="open">Open</option>
                    <option value="investigating">
                      Investigating
                    </option>
                    <option value="monitoring">Monitoring</option>
                    <option value="resolved">Resolved</option>
                    <option value="dismissed">Dismissed</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </label>

                <label className="relative">
                  <select
                    value={typeFilter}
                    onChange={(event) =>
                      setTypeFilter(event.target.value)
                    }
                    className="h-12 min-w-48 appearance-none rounded-2xl border border-white/[0.08] bg-slate-900/70 px-4 pr-10 text-sm font-semibold text-slate-300 outline-none"
                  >
                    <option value="all">All detection types</option>
                    {fraudTypes.map((type) => (
                      <option key={type} value={type}>
                        {typeLabels[type] ||
                          type.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </label>
              </div>
            </div>

            <div className="max-h-[920px] overflow-y-auto">
              {loading ? (
                <div className="flex min-h-80 flex-col items-center justify-center">
                  <Loader2 className="h-9 w-9 animate-spin text-emerald-300" />
                  <p className="mt-4 font-bold text-slate-300">
                    Loading fraud intelligence...
                  </p>
                </div>
              ) : filteredCases.length === 0 ? (
                <div className="flex min-h-80 flex-col items-center justify-center px-6 text-center">
                  <ShieldCheck className="h-12 w-12 text-emerald-300" />
                  <p className="mt-4 text-lg font-black">
                    No matching fraud cases
                  </p>
                  <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                    Adjust your filters or run a new AI fraud scan
                    to analyze current RoadLink activity.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.05]">
                  {filteredCases.map((fraudCase) => (
                    <button
                      key={fraudCase.id}
                      type="button"
                      onClick={() => setSelectedCase(fraudCase)}
                      className="group w-full p-5 text-left transition hover:bg-white/[0.025] sm:p-6"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${severityStyles[fraudCase.severity]}`}
                            >
                              {fraudCase.severity}
                            </span>

                            <span
                              className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${statusStyles[fraudCase.status]}`}
                            >
                              {statusLabels[fraudCase.status]}
                            </span>

                            <span className="rounded-full border border-white/[0.07] bg-white/[0.035] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                              {typeLabels[fraudCase.type] ||
                                fraudCase.type.replaceAll("_", " ")}
                            </span>
                          </div>

                          <h3 className="mt-3 truncate text-base font-black text-white transition group-hover:text-emerald-300">
                            {fraudCase.userEmail ||
                              fraudCase.userId ||
                              fraudCase.entityId ||
                              fraudCase.id}
                          </h3>

                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-400">
                            {fraudCase.description}
                          </p>

                          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                            <span className="inline-flex items-center gap-1.5">
                              <Clock3 className="h-3.5 w-3.5" />
                              {formatRelative(
                                fraudCase.updatedAt ||
                                  fraudCase.createdAt,
                              )}
                            </span>

                            <span className="inline-flex items-center gap-1.5">
                              <Fingerprint className="h-3.5 w-3.5" />
                              {fraudCase.id}
                            </span>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-4">
                          <ScoreRing
                            score={safeNumber(fraudCase.fraudScore)}
                            label="Fraud"
                            size="small"
                          />
                          <ScoreRing
                            score={safeNumber(fraudCase.riskScore)}
                            label="Risk"
                            size="small"
                          />
                          <Eye className="hidden h-5 w-5 text-slate-600 transition group-hover:text-emerald-300 sm:block" />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[2rem] border border-white/[0.07] bg-slate-950/55 p-5 shadow-2xl shadow-black/25 backdrop-blur-2xl sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black">
                    Highest risk entities
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Ranked by active risk score
                  </p>
                </div>

                <UsersRound className="h-6 w-6 text-violet-300" />
              </div>

              <div className="mt-5 space-y-3">
                {topRisks.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/[0.08] p-6 text-center">
                    <ShieldCheck className="mx-auto h-8 w-8 text-emerald-300" />
                    <p className="mt-3 text-sm font-bold text-slate-300">
                      No active high-risk entities
                    </p>
                  </div>
                ) : (
                  topRisks.map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedCase(item)}
                      className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3 text-left transition hover:border-emerald-400/20 hover:bg-emerald-400/[0.04]"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-sm font-black text-slate-300">
                        {index + 1}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-white">
                          {item.userEmail ||
                            item.userId ||
                            item.entityId ||
                            item.id}
                        </p>
                        <p className="mt-1 truncate text-xs text-slate-500">
                          {typeLabels[item.type] ||
                            item.type.replaceAll("_", " ")}
                        </p>
                      </div>

                      <div className="text-right">
                        <p
                          className={`text-lg font-black ${
                            item.riskScore >= 80
                              ? "text-red-300"
                              : item.riskScore >= 60
                                ? "text-orange-300"
                                : "text-amber-300"
                          }`}
                        >
                          {item.riskScore}
                        </p>
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600">
                          Risk
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/[0.07] bg-slate-950/55 p-5 shadow-2xl shadow-black/25 backdrop-blur-2xl sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black">
                    Fraud intelligence timeline
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Latest case activity
                  </p>
                </div>

                <Activity className="h-6 w-6 text-emerald-300" />
              </div>

              <div className="relative mt-6 space-y-5 before:absolute before:bottom-2 before:left-[9px] before:top-2 before:w-px before:bg-white/[0.08]">
                {timeline.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-white/[0.08] p-5 text-center text-sm text-slate-500">
                    Timeline data will appear after the first scan.
                  </p>
                ) : (
                  timeline.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedCase(item)}
                      className="relative flex w-full gap-4 text-left"
                    >
                      <span
                        className={`relative z-10 mt-1 h-[19px] w-[19px] shrink-0 rounded-full border-4 border-[#020617] ${
                          item.severity === "critical"
                            ? "bg-red-400"
                            : item.severity === "high"
                              ? "bg-orange-400"
                              : item.severity === "medium"
                                ? "bg-amber-400"
                                : "bg-cyan-400"
                        }`}
                      />

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-200">
                          {typeLabels[item.type] ||
                            item.type.replaceAll("_", " ")}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                          {item.description}
                        </p>
                        <p className="mt-1 text-[11px] font-semibold text-slate-600">
                          {formatRelative(
                            item.updatedAt || item.createdAt,
                          )}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      {selectedCase && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-md sm:items-center sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-label="Fraud case details"
        >
          <button
            type="button"
            onClick={() => setSelectedCase(null)}
            className="absolute inset-0 cursor-default"
            aria-label="Close case details"
          />

          <div className="relative z-10 max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-t-[2rem] border border-white/[0.08] bg-[#030712] shadow-2xl shadow-black sm:rounded-[2rem]">
            <div className="sticky top-0 z-20 flex items-center justify-between border-b border-white/[0.06] bg-[#030712]/95 p-5 backdrop-blur-xl sm:p-6">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${severityStyles[selectedCase.severity]}`}
                  >
                    {selectedCase.severity}
                  </span>

                  <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${statusStyles[selectedCase.status]}`}
                  >
                    {statusLabels[selectedCase.status]}
                  </span>
                </div>

                <h2 className="mt-3 truncate text-xl font-black sm:text-2xl">
                  {typeLabels[selectedCase.type] ||
                    selectedCase.type.replaceAll("_", " ")}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCase(null)}
                className="ml-4 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-slate-400 transition hover:bg-white/[0.08] hover:text-white"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 sm:p-7">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-5 text-center">
                  <ScoreRing
                    score={safeNumber(selectedCase.fraudScore)}
                    label="Fraud"
                  />
                </div>

                <div className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-5 text-center">
                  <ScoreRing
                    score={safeNumber(selectedCase.riskScore)}
                    label="Risk"
                  />
                </div>

                <div className="flex flex-col justify-center rounded-3xl border border-white/[0.06] bg-white/[0.025] p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                    AI Confidence
                  </p>
                  <p className="mt-3 text-4xl font-black text-white">
                    {selectedCase.confidence}%
                  </p>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.05]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-300"
                      style={{
                        width: `${selectedCase.confidence}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.85fr]">
                <div className="space-y-5">
                  <div className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-5">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-300" />
                      <h3 className="font-black">
                        Detection summary
                      </h3>
                    </div>

                    <p className="mt-4 text-sm leading-7 text-slate-300">
                      {selectedCase.description}
                    </p>
                  </div>

                  <div className="rounded-3xl border border-emerald-500/15 bg-emerald-500/[0.06] p-5">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-emerald-300" />
                      <h3 className="font-black text-emerald-100">
                        AI recommendation
                      </h3>
                    </div>

                    <p className="mt-4 text-sm leading-7 text-emerald-100/80">
                      {selectedCase.recommendation}
                    </p>
                  </div>

                  <div className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-5">
                    <div className="flex items-center gap-2">
                      <FileSearch className="h-5 w-5 text-cyan-300" />
                      <h3 className="font-black">Evidence</h3>
                    </div>

                    <div className="mt-4 space-y-2">
                      {selectedCase.evidence?.length ? (
                        selectedCase.evidence.map(
                          (evidence, index) => (
                            <div
                              key={`${evidence}-${index}`}
                              className="flex items-start gap-3 rounded-2xl border border-white/[0.05] bg-slate-950/50 p-3"
                            >
                              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-cyan-300" />
                              <span className="text-sm leading-6 text-slate-400">
                                {evidence}
                              </span>
                            </div>
                          ),
                        )
                      ) : (
                        <p className="text-sm text-slate-500">
                          No additional evidence was stored for this
                          case.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-5">
                    <h3 className="font-black">Entity details</h3>

                    <dl className="mt-4 space-y-4">
                      {[
                        ["Case ID", selectedCase.id],
                        ["User ID", selectedCase.userId],
                        ["Email", selectedCase.userEmail],
                        ["Entity ID", selectedCase.entityId],
                        ["Entity type", selectedCase.entityType],
                        [
                          "Created",
                          formatDate(selectedCase.createdAt),
                        ],
                        [
                          "Updated",
                          formatDate(
                            selectedCase.updatedAt ||
                              selectedCase.createdAt,
                          ),
                        ],
                        ["Created by", selectedCase.createdBy],
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          className="border-b border-white/[0.05] pb-3 last:border-0 last:pb-0"
                        >
                          <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">
                            {label}
                          </dt>
                          <dd className="mt-1 break-all text-sm font-semibold text-slate-300">
                            {value || "Not available"}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>

                  <div className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-5">
                    <h3 className="font-black">
                      Resolution controls
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Every status change generates a RoadLink audit
                      log.
                    </p>

                    <div className="mt-5 grid gap-3">
                      <button
                        type="button"
                        disabled={
                          updatingCaseId === selectedCase.id ||
                          selectedCase.status === "investigating"
                        }
                        onClick={() =>
                          updateCaseStatus(
                            selectedCase,
                            "investigating",
                          )
                        }
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 text-sm font-black text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {updatingCaseId === selectedCase.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <UserRoundSearch className="h-4 w-4" />
                        )}
                        Start investigation
                      </button>

                      <button
                        type="button"
                        disabled={
                          updatingCaseId === selectedCase.id ||
                          selectedCase.status === "monitoring"
                        }
                        onClick={() =>
                          updateCaseStatus(
                            selectedCase,
                            "monitoring",
                          )
                        }
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 text-sm font-black text-cyan-200 transition hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Eye className="h-4 w-4" />
                        Move to monitoring
                      </button>

                      <button
                        type="button"
                        disabled={
                          updatingCaseId === selectedCase.id ||
                          selectedCase.status === "resolved"
                        }
                        onClick={() =>
                          updateCaseStatus(
                            selectedCase,
                            "resolved",
                          )
                        }
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 text-sm font-black text-emerald-200 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Resolve case
                      </button>

                      <button
                        type="button"
                        disabled={
                          updatingCaseId === selectedCase.id ||
                          selectedCase.status === "dismissed"
                        }
                        onClick={() =>
                          updateCaseStatus(
                            selectedCase,
                            "dismissed",
                          )
                        }
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-500/20 bg-slate-500/10 px-4 text-sm font-black text-slate-300 transition hover:bg-slate-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <XCircle className="h-4 w-4" />
                        Dismiss false positive
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-4">
                      <Bot className="h-5 w-5 text-violet-300" />
                      <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-600">
                        Source
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-300">
                        AI Engine
                      </p>
                    </div>

                    <div className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-4">
                      {selectedCase.type.includes("payout") ||
                      selectedCase.type.includes("wallet") ||
                      selectedCase.type.includes("payment") ? (
                        <WalletCards className="h-5 w-5 text-emerald-300" />
                      ) : selectedCase.type.includes("duplicate") ||
                        selectedCase.type.includes("account") ? (
                        <UsersRound className="h-5 w-5 text-cyan-300" />
                      ) : (
                        <LockKeyhole className="h-5 w-5 text-amber-300" />
                      )}

                      <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-600">
                        Domain
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-300">
                        {selectedCase.type.includes("payout") ||
                        selectedCase.type.includes("wallet") ||
                        selectedCase.type.includes("payment")
                          ? "Financial"
                          : selectedCase.type.includes("duplicate") ||
                              selectedCase.type.includes("account")
                            ? "Identity"
                            : "Marketplace"}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/[0.06] bg-gradient-to-br from-emerald-500/[0.08] to-cyan-500/[0.03] p-5">
                    <div className="flex items-center gap-2">
                      <CircleDollarSign className="h-5 w-5 text-emerald-300" />
                      <p className="font-black">Financial safety</p>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-400">
                      Critical financial cases should be reviewed
                      before RoadLink releases wallet funds or payout
                      requests.
                    </p>
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
