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
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  FileImage,
  FileSearch,
  Gavel,
  History,
  Loader2,
  MessageSquareText,
  RefreshCcw,
  RotateCcw,
  Scale,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserRound,
  UserRoundCheck,
  UserRoundCog,
  UsersRound,
  WalletCards,
  X,
  XCircle,
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

type DisputeStatus =
  | "open"
  | "under_review"
  | "awaiting_evidence"
  | "escalated"
  | "approved"
  | "rejected"
  | "resolved"
  | "closed";

type DisputePriority =
  | "critical"
  | "high"
  | "medium"
  | "low";

type DisputeType =
  | "payment"
  | "refund"
  | "driver_behavior"
  | "passenger_behavior"
  | "ride_quality"
  | "cancellation"
  | "no_show"
  | "safety"
  | "fraud"
  | "other";

type StatusFilter = "all" | DisputeStatus;
type PriorityFilter = "all" | DisputePriority;
type TypeFilter = "all" | DisputeType;

type EvidenceItem = {
  id?: string;
  type?: "image" | "document" | "message" | "video" | "other";
  label?: string;
  url?: string;
  description?: string;
  uploadedBy?: string;
  createdAt?: TimestampLike;
};

type DisputeTimelineItem = {
  id?: string;
  action?: string;
  description?: string;
  actorEmail?: string;
  createdAt?: TimestampLike;
};

type DisputeItem = {
  id: string;
  caseNumber?: string;
  title?: string;
  description?: string;
  type: DisputeType;
  status: DisputeStatus;
  priority: DisputePriority;

  passengerId?: string;
  passengerEmail?: string;
  passengerName?: string;

  driverId?: string;
  driverEmail?: string;
  driverName?: string;

  rideId?: string;
  bookingId?: string;

  routeFrom?: string;
  routeTo?: string;
  rideDate?: TimestampLike;

  amount?: number;
  disputedAmount?: number;
  refundAmount?: number;
  currency?: string;
  paymentIntentId?: string;
  chargeId?: string;
  paymentStatus?: string;

  assignedAgentId?: string;
  assignedAgentEmail?: string;
  assignedAgentName?: string;

  reporterId?: string;
  reporterEmail?: string;
  reporterRole?: "passenger" | "driver" | "admin" | "system";

  reason?: string;
  resolution?: string;
  internalNotes?: string;
  customerMessage?: string;

  evidence?: EvidenceItem[];
  timeline?: DisputeTimelineItem[];

  refundRequested?: boolean;
  refundRequestId?: string;
  refundType?: "partial" | "full";
  refundStatus?: string;

  escalated?: boolean;
  supervisorReview?: boolean;

  createdAt?: TimestampLike;
  updatedAt?: TimestampLike;
  resolvedAt?: TimestampLike;
  closedAt?: TimestampLike;
  resolvedBy?: string;
  closedBy?: string;
};

type RefundRequest = {
  id: string;
  disputeId: string;
  bookingId?: string;
  rideId?: string;
  passengerId?: string;
  passengerEmail?: string;
  driverId?: string;
  driverEmail?: string;
  paymentIntentId?: string;
  chargeId?: string;
  refundType: "partial" | "full";
  amount: number;
  originalAmount: number;
  currency: string;
  reason: string;
  status: "pending";
  createdAt?: TimestampLike;
  createdBy?: string;
};

type AdminAgent = {
  id: string;
  email?: string;
  name?: string;
  role?: string;
  status?: string;
};

const STATUS_LABELS: Record<DisputeStatus, string> = {
  open: "Open",
  under_review: "Under review",
  awaiting_evidence: "Awaiting evidence",
  escalated: "Escalated",
  approved: "Approved",
  rejected: "Rejected",
  resolved: "Resolved",
  closed: "Closed",
};

const STATUS_STYLES: Record<DisputeStatus, string> = {
  open: "border-cyan-500/25 bg-cyan-500/10 text-cyan-300",
  under_review:
    "border-amber-500/25 bg-amber-500/10 text-amber-300",
  awaiting_evidence:
    "border-violet-500/25 bg-violet-500/10 text-violet-300",
  escalated:
    "border-red-500/25 bg-red-500/10 text-red-300",
  approved:
    "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  rejected:
    "border-orange-500/25 bg-orange-500/10 text-orange-300",
  resolved:
    "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  closed:
    "border-slate-500/25 bg-slate-500/10 text-slate-300",
};

const PRIORITY_LABELS: Record<DisputePriority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const PRIORITY_STYLES: Record<DisputePriority, string> = {
  critical:
    "border-red-500/30 bg-red-500/10 text-red-300",
  high:
    "border-orange-500/30 bg-orange-500/10 text-orange-300",
  medium:
    "border-amber-500/30 bg-amber-500/10 text-amber-300",
  low:
    "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
};

const TYPE_LABELS: Record<DisputeType, string> = {
  payment: "Payment",
  refund: "Refund",
  driver_behavior: "Driver behavior",
  passenger_behavior: "Passenger behavior",
  ride_quality: "Ride quality",
  cancellation: "Cancellation",
  no_show: "No-show",
  safety: "Safety",
  fraud: "Fraud",
  other: "Other",
};

const PRIORITY_ORDER: Record<DisputePriority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function safeNumber(value: unknown) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
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

function formatCurrency(
  value: number,
  currency = "USD",
) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function isActiveStatus(status: DisputeStatus) {
  return ![
    "approved",
    "rejected",
    "resolved",
    "closed",
  ].includes(status);
}

function generateCaseNumber(id: string) {
  return `DSP-${id
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 8)
    .toUpperCase()}`;
}

function evidenceIcon(type?: EvidenceItem["type"]) {
  if (type === "image" || type === "video") {
    return <FileImage className="h-4 w-4" />;
  }

  if (type === "message") {
    return <MessageSquareText className="h-4 w-4" />;
  }

  return <FileSearch className="h-4 w-4" />;
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
  const tones = {
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
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${tones[tone]}`}
        >
          {icon}
        </div>
      </div>
    </article>
  );
}

export default function DisputesPage() {
  const [disputes, setDisputes] = useState<DisputeItem[]>(
    [],
  );

  const [agents, setAgents] = useState<AdminAgent[]>([]);

  const [selectedDispute, setSelectedDispute] =
    useState<DisputeItem | null>(null);

  const [loading, setLoading] = useState(true);

  const [updatingDisputeId, setUpdatingDisputeId] =
    useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("all");

  const [priorityFilter, setPriorityFilter] =
    useState<PriorityFilter>("all");

  const [typeFilter, setTypeFilter] =
    useState<TypeFilter>("all");

  const [internalNote, setInternalNote] = useState("");
  const [customerMessage, setCustomerMessage] =
    useState("");

  const [resolutionText, setResolutionText] =
    useState("");

  const [refundAmount, setRefundAmount] = useState(0);

  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const unsubscribeDisputes = onSnapshot(
      query(
        collection(db, "disputes"),
        orderBy("createdAt", "desc"),
        limit(500),
      ),
      (snapshot) => {
        const items = snapshot.docs.map(
          (document) =>
            ({
              id: document.id,
              ...document.data(),
            }) as DisputeItem,
        );

        setDisputes(items);
        setLoading(false);
      },
      (error) => {
        console.error("Disputes listener failed:", error);

        setErrorMessage(
          "RoadLink could not load disputes. Verify Firestore permissions and indexes.",
        );

        setLoading(false);
      },
    );

    const unsubscribeAgents = onSnapshot(
      query(collection(db, "users"), limit(1000)),
      (snapshot) => {
        const items = snapshot.docs
          .map(
            (document) =>
              ({
                id: document.id,
                ...document.data(),
              }) as AdminAgent,
          )
          .filter((user) =>
            [
              "admin",
              "super_admin",
              "support",
              "support_agent",
              "manager",
            ].includes(normalizeStatus(user.role)),
          );

        setAgents(items);
      },
      (error) => {
        console.error("Agents listener failed:", error);
      },
    );

    return () => {
      unsubscribeDisputes();
      unsubscribeAgents();
    };
  }, []);

  useEffect(() => {
    if (!selectedDispute) return;

    setInternalNote(selectedDispute.internalNotes || "");
    setCustomerMessage(
      selectedDispute.customerMessage || "",
    );

    setResolutionText(
      selectedDispute.resolution || "",
    );

    setRefundAmount(
      Math.max(
        safeNumber(selectedDispute.refundAmount),
        safeNumber(selectedDispute.disputedAmount),
        safeNumber(selectedDispute.amount),
      ),
    );
  }, [selectedDispute]);

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
        module: "disputes",
        action,
        description,
        entityId: entityId ?? null,
        metadata: metadata ?? {},
        actorId: auth.currentUser?.uid || "system",
        actorEmail:
          auth.currentUser?.email ||
          "disputes-engine@roadlink.system",
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
      audience,
      userId,
      entityId,
    }: {
      title: string;
      notificationMessage: string;
      severity: "low" | "medium" | "high" | "critical";
      audience: "admin" | "user" | "driver";
      userId?: string;
      entityId?: string;
    }) => {
      const reference = doc(
        collection(db, "notifications"),
      );

      await setDoc(reference, {
        id: reference.id,
        title,
        message: notificationMessage,
        type: "dispute_update",
        severity,
        audience,
        userId: userId ?? null,
        entityId: entityId ?? null,
        read: false,
        createdAt: serverTimestamp(),
        createdBy:
          auth.currentUser?.email ||
          "disputes-engine",
      });
    },
    [],
  );

  const createTimelineEntry = useCallback(
    async ({
      dispute,
      action,
      description,
    }: {
      dispute: DisputeItem;
      action: string;
      description: string;
    }) => {
      const reference = doc(
        collection(
          db,
          "disputes",
          dispute.id,
          "timeline",
        ),
      );

      await setDoc(reference, {
        id: reference.id,
        disputeId: dispute.id,
        action,
        description,
        actorId: auth.currentUser?.uid || "system",
        actorEmail:
          auth.currentUser?.email ||
          "RoadLink Admin",
        createdAt: serverTimestamp(),
      });
    },
    [],
  );

  const updateDisputeStatus = useCallback(
    async (
      dispute: DisputeItem,
      newStatus: DisputeStatus,
      resolution?: string,
    ) => {
      setUpdatingDisputeId(dispute.id);
      setMessage("");
      setErrorMessage("");

      try {
        const isResolved = [
          "approved",
          "rejected",
          "resolved",
          "closed",
        ].includes(newStatus);

        const payload: Record<string, unknown> = {
          status: newStatus,
          updatedAt: serverTimestamp(),
          updatedBy:
            auth.currentUser?.email ||
            "RoadLink Admin",
        };

        if (resolution?.trim()) {
          payload.resolution = resolution.trim();
        }

        if (
          ["approved", "rejected", "resolved"].includes(
            newStatus,
          )
        ) {
          payload.resolvedAt = serverTimestamp();
          payload.resolvedBy =
            auth.currentUser?.email ||
            "RoadLink Admin";
        }

        if (newStatus === "closed") {
          payload.closedAt = serverTimestamp();
          payload.closedBy =
            auth.currentUser?.email ||
            "RoadLink Admin";
        }

        if (newStatus === "escalated") {
          payload.escalated = true;
          payload.supervisorReview = true;
        }

        await updateDoc(
          doc(db, "disputes", dispute.id),
          payload,
        );

        await createTimelineEntry({
          dispute,
          action: "STATUS_UPDATED",
          description: `Dispute status changed from ${
            STATUS_LABELS[dispute.status]
          } to ${STATUS_LABELS[newStatus]}.`,
        });

        await createAuditLog({
          action: "DISPUTE_STATUS_UPDATED",
          description: `Dispute ${
            dispute.caseNumber ||
            generateCaseNumber(dispute.id)
          } changed to ${newStatus}.`,
          entityId: dispute.id,
          metadata: {
            previousStatus: dispute.status,
            newStatus,
            priority: dispute.priority,
            type: dispute.type,
            resolution: resolution || null,
          },
        });

        if (newStatus === "escalated") {
          await createNotification({
            title: "Dispute escalated",
            notificationMessage: `${
              dispute.caseNumber ||
              generateCaseNumber(dispute.id)
            } requires supervisor review.`,
            severity: "critical",
            audience: "admin",
            entityId: dispute.id,
          });
        }

        if (isResolved) {
          if (dispute.passengerId) {
            await createNotification({
              title: "Dispute status updated",
              notificationMessage: `Your dispute is now ${STATUS_LABELS[
                newStatus
              ].toLowerCase()}.`,
              severity:
                newStatus === "approved"
                  ? "low"
                  : "medium",
              audience: "user",
              userId: dispute.passengerId,
              entityId: dispute.id,
            });
          }

          if (dispute.driverId) {
            await createNotification({
              title: "Dispute status updated",
              notificationMessage: `The dispute for your ride is now ${STATUS_LABELS[
                newStatus
              ].toLowerCase()}.`,
              severity: "medium",
              audience: "driver",
              userId: dispute.driverId,
              entityId: dispute.id,
            });
          }
        }

        setSelectedDispute((current) =>
          current?.id === dispute.id
            ? {
                ...current,
                status: newStatus,
                resolution:
                  resolution?.trim() ||
                  current.resolution,
              }
            : current,
        );

        setMessage(
          `${
            dispute.caseNumber ||
            generateCaseNumber(dispute.id)
          } updated to ${STATUS_LABELS[
            newStatus
          ]}.`,
        );
      } catch (error) {
        console.error(
          "Update dispute status failed:",
          error,
        );

        setErrorMessage(
          "RoadLink could not update this dispute.",
        );
      } finally {
        setUpdatingDisputeId(null);
      }
    },
    [
      createAuditLog,
      createNotification,
      createTimelineEntry,
    ],
  );

  const assignAgent = useCallback(
    async (
      dispute: DisputeItem,
      agentId: string,
    ) => {
      setUpdatingDisputeId(dispute.id);
      setMessage("");
      setErrorMessage("");

      try {
        const agent = agents.find(
          (item) => item.id === agentId,
        );

        await updateDoc(
          doc(db, "disputes", dispute.id),
          {
            assignedAgentId: agent?.id || null,
            assignedAgentEmail:
              agent?.email || null,
            assignedAgentName:
              agent?.name || null,
            status:
              dispute.status === "open"
                ? "under_review"
                : dispute.status,
            updatedAt: serverTimestamp(),
            updatedBy:
              auth.currentUser?.email ||
              "RoadLink Admin",
          },
        );

        await createTimelineEntry({
          dispute,
          action: "AGENT_ASSIGNED",
          description: agent
            ? `Dispute assigned to ${
                agent.name ||
                agent.email ||
                agent.id
              }.`
            : "Agent assignment removed.",
        });

        await createAuditLog({
          action: "DISPUTE_AGENT_ASSIGNED",
          description: agent
            ? `Dispute assigned to ${
                agent.email || agent.id
              }.`
            : "Dispute agent assignment removed.",
          entityId: dispute.id,
          metadata: {
            assignedAgentId: agent?.id || null,
            assignedAgentEmail:
              agent?.email || null,
          },
        });

        setSelectedDispute((current) =>
          current?.id === dispute.id
            ? {
                ...current,
                assignedAgentId: agent?.id,
                assignedAgentEmail:
                  agent?.email,
                assignedAgentName: agent?.name,
                status:
                  current.status === "open"
                    ? "under_review"
                    : current.status,
              }
            : current,
        );

        setMessage(
          agent
            ? `Dispute assigned to ${
                agent.name ||
                agent.email ||
                "the selected agent"
              }.`
            : "Agent assignment removed.",
        );
      } catch (error) {
        console.error(
          "Assign dispute agent failed:",
          error,
        );

        setErrorMessage(
          "RoadLink could not assign this dispute.",
        );
      } finally {
        setUpdatingDisputeId(null);
      }
    },
    [agents, createAuditLog, createTimelineEntry],
  );

  const saveCaseNotes = useCallback(
    async (dispute: DisputeItem) => {
      setUpdatingDisputeId(dispute.id);
      setMessage("");
      setErrorMessage("");

      try {
        await updateDoc(
          doc(db, "disputes", dispute.id),
          {
            internalNotes: internalNote.trim(),
            customerMessage: customerMessage.trim(),
            updatedAt: serverTimestamp(),
            updatedBy:
              auth.currentUser?.email ||
              "RoadLink Admin",
          },
        );

        await createTimelineEntry({
          dispute,
          action: "CASE_NOTES_UPDATED",
          description:
            "Internal notes and customer communication were updated.",
        });

        await createAuditLog({
          action: "DISPUTE_NOTES_UPDATED",
          description: `Case notes updated for ${
            dispute.caseNumber ||
            generateCaseNumber(dispute.id)
          }.`,
          entityId: dispute.id,
          metadata: {
            hasInternalNote: Boolean(
              internalNote.trim(),
            ),
            hasCustomerMessage: Boolean(
              customerMessage.trim(),
            ),
          },
        });

        if (
          customerMessage.trim() &&
          dispute.passengerId
        ) {
          await createNotification({
            title: "Message about your dispute",
            notificationMessage:
              customerMessage.trim(),
            severity: "medium",
            audience: "user",
            userId: dispute.passengerId,
            entityId: dispute.id,
          });
        }

        setSelectedDispute((current) =>
          current?.id === dispute.id
            ? {
                ...current,
                internalNotes:
                  internalNote.trim(),
                customerMessage:
                  customerMessage.trim(),
              }
            : current,
        );

        setMessage("Case notes saved successfully.");
      } catch (error) {
        console.error(
          "Save dispute notes failed:",
          error,
        );

        setErrorMessage(
          "RoadLink could not save the case notes.",
        );
      } finally {
        setUpdatingDisputeId(null);
      }
    },
    [
      createAuditLog,
      createNotification,
      createTimelineEntry,
      customerMessage,
      internalNote,
    ],
  );

  const requestRefund = useCallback(
    async (
      dispute: DisputeItem,
      refundType: "partial" | "full",
    ) => {
      setUpdatingDisputeId(dispute.id);
      setMessage("");
      setErrorMessage("");

      try {
        const originalAmount = Math.max(
          safeNumber(dispute.amount),
          safeNumber(dispute.disputedAmount),
        );

        const amount =
          refundType === "full"
            ? originalAmount
            : Math.min(
                Math.max(refundAmount, 0),
                originalAmount,
              );

        if (amount <= 0) {
          throw new Error(
            "Refund amount must be greater than zero.",
          );
        }

        const reference = doc(
          collection(db, "refundRequests"),
        );

        const refundRequest: RefundRequest = {
          id: reference.id,
          disputeId: dispute.id,
          bookingId: dispute.bookingId,
          rideId: dispute.rideId,
          passengerId: dispute.passengerId,
          passengerEmail:
            dispute.passengerEmail,
          driverId: dispute.driverId,
          driverEmail: dispute.driverEmail,
          paymentIntentId:
            dispute.paymentIntentId,
          chargeId: dispute.chargeId,
          refundType,
          amount,
          originalAmount,
          currency:
            dispute.currency || "USD",
          reason:
            resolutionText.trim() ||
            dispute.reason ||
            "Approved RoadLink dispute refund",
          status: "pending",
          createdAt: serverTimestamp(),
          createdBy:
            auth.currentUser?.email ||
            "RoadLink Admin",
        };

        await setDoc(reference, refundRequest);

        await updateDoc(
          doc(db, "disputes", dispute.id),
          {
            refundRequested: true,
            refundRequestId: reference.id,
            refundType,
            refundAmount: amount,
            refundStatus: "pending",
            status: "approved",
            resolution:
              resolutionText.trim() ||
              `A ${refundType} refund was approved for ${formatCurrency(
                amount,
                dispute.currency,
              )}.`,
            resolvedAt: serverTimestamp(),
            resolvedBy:
              auth.currentUser?.email ||
              "RoadLink Admin",
            updatedAt: serverTimestamp(),
          },
        );

        await createTimelineEntry({
          dispute,
          action: "REFUND_REQUESTED",
          description: `${refundType} refund requested for ${formatCurrency(
            amount,
            dispute.currency,
          )}.`,
        });

        await createAuditLog({
          action: "DISPUTE_REFUND_REQUESTED",
          description: `${refundType} refund requested for dispute ${
            dispute.caseNumber ||
            generateCaseNumber(dispute.id)
          }.`,
          entityId: dispute.id,
          metadata: {
            refundRequestId: reference.id,
            refundType,
            refundAmount: amount,
            paymentIntentId:
              dispute.paymentIntentId || null,
          },
        });

        await createNotification({
          title: "Refund request created",
          notificationMessage: `${formatCurrency(
            amount,
            dispute.currency,
          )} refund request requires payment processing.`,
          severity: "high",
          audience: "admin",
          entityId: dispute.id,
        });

        if (dispute.passengerId) {
          await createNotification({
            title: "Your refund was approved",
            notificationMessage: `A ${refundType} refund of ${formatCurrency(
              amount,
              dispute.currency,
            )} has been approved and is pending processing.`,
            severity: "low",
            audience: "user",
            userId: dispute.passengerId,
            entityId: dispute.id,
          });
        }

        setSelectedDispute((current) =>
          current?.id === dispute.id
            ? {
                ...current,
                refundRequested: true,
                refundRequestId: reference.id,
                refundType,
                refundAmount: amount,
                refundStatus: "pending",
                status: "approved",
              }
            : current,
        );

        setMessage(
          `${refundType} refund request created for ${formatCurrency(
            amount,
            dispute.currency,
          )}.`,
        );
      } catch (error) {
        console.error(
          "Create refund request failed:",
          error,
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "RoadLink could not create the refund request.",
        );
      } finally {
        setUpdatingDisputeId(null);
      }
    },
    [
      createAuditLog,
      createNotification,
      createTimelineEntry,
      refundAmount,
      resolutionText,
    ],
  );

  const filteredDisputes = useMemo(() => {
    const search = normalizeString(searchTerm);

    return disputes
      .filter((dispute) => {
        const matchesSearch =
          !search ||
          normalizeString(
            [
              dispute.caseNumber,
              dispute.id,
              dispute.title,
              dispute.description,
              dispute.reason,
              dispute.passengerName,
              dispute.passengerEmail,
              dispute.driverName,
              dispute.driverEmail,
              dispute.rideId,
              dispute.bookingId,
              dispute.routeFrom,
              dispute.routeTo,
            ].join(" "),
          ).includes(search);

        const matchesStatus =
          statusFilter === "all" ||
          dispute.status === statusFilter;

        const matchesPriority =
          priorityFilter === "all" ||
          dispute.priority === priorityFilter;

        const matchesType =
          typeFilter === "all" ||
          dispute.type === typeFilter;

        return (
          matchesSearch &&
          matchesStatus &&
          matchesPriority &&
          matchesType
        );
      })
      .sort((first, second) => {
        const activeDifference =
          Number(isActiveStatus(second.status)) -
          Number(isActiveStatus(first.status));

        if (activeDifference !== 0) {
          return activeDifference;
        }

        const priorityDifference =
          PRIORITY_ORDER[second.priority] -
          PRIORITY_ORDER[first.priority];

        if (priorityDifference !== 0) {
          return priorityDifference;
        }

        return (
          getTime(second.updatedAt || second.createdAt) -
          getTime(first.updatedAt || first.createdAt)
        );
      });
  }, [
    disputes,
    priorityFilter,
    searchTerm,
    statusFilter,
    typeFilter,
  ]);

  const metrics = useMemo(() => {
    const open = disputes.filter((dispute) =>
      isActiveStatus(dispute.status),
    ).length;

    const critical = disputes.filter(
      (dispute) =>
        isActiveStatus(dispute.status) &&
        dispute.priority === "critical",
    ).length;

    const escalated = disputes.filter(
      (dispute) =>
        dispute.status === "escalated" ||
        dispute.escalated,
    ).length;

    const resolved = disputes.filter((dispute) =>
      [
        "approved",
        "rejected",
        "resolved",
        "closed",
      ].includes(dispute.status),
    ).length;

    const disputedValue = disputes
      .filter((dispute) =>
        isActiveStatus(dispute.status),
      )
      .reduce(
        (total, dispute) =>
          total +
          Math.max(
            safeNumber(dispute.disputedAmount),
            safeNumber(dispute.amount),
          ),
        0,
      );

    const refundedValue = disputes.reduce(
      (total, dispute) =>
        total +
        (dispute.refundRequested
          ? safeNumber(dispute.refundAmount)
          : 0),
      0,
    );

    const resolutionRate =
      disputes.length > 0
        ? (resolved / disputes.length) * 100
        : 0;

    return {
      open,
      critical,
      escalated,
      resolved,
      disputedValue,
      refundedValue,
      resolutionRate,
    };
  }, [disputes]);

  const topPriorityCases = useMemo(
    () =>
      disputes
        .filter((dispute) =>
          isActiveStatus(dispute.status),
        )
        .sort((first, second) => {
          const priorityDifference =
            PRIORITY_ORDER[second.priority] -
            PRIORITY_ORDER[first.priority];

          if (priorityDifference !== 0) {
            return priorityDifference;
          }

          return (
            getTime(first.createdAt) -
            getTime(second.createdAt)
          );
        })
        .slice(0, 6),
    [disputes],
  );

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-12%] top-[-14%] h-[34rem] w-[34rem] rounded-full bg-emerald-500/10 blur-[150px]" />
        <div className="absolute right-[-10%] top-[12%] h-[32rem] w-[32rem] rounded-full bg-red-500/[0.08] blur-[160px]" />
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
                Disputes
              </span>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10">
                <Scale className="h-7 w-7 text-emerald-300" />
              </div>

              <div>
                <h1 className="text-2xl font-black sm:text-4xl">
                  Disputes Management Center
                </h1>

                <p className="mt-1 max-w-3xl text-sm text-slate-400 sm:text-base">
                  Investigate, assign, resolve and audit
                  passenger and driver disputes across
                  RoadLink.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.07] bg-slate-950/60 px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
              Case Operations
            </p>

            <div className="mt-1 flex items-center gap-2 text-sm font-black text-emerald-300">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </span>

              Real-time monitoring active
            </div>
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
              <AlertOctagon className="mt-0.5 h-5 w-5 shrink-0" />
            ) : (
              <Activity className="mt-0.5 h-5 w-5 shrink-0" />
            )}

            <div className="min-w-0 flex-1">
              <p className="font-black">
                {errorMessage
                  ? "Dispute management alert"
                  : "Dispute center updated"}
              </p>

              <p className="mt-1 text-sm opacity-80">
                {errorMessage || message}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setMessage("");
                setErrorMessage("");
              }}
              className="opacity-60 transition hover:opacity-100"
              aria-label="Close alert"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            title="Open Cases"
            value={metrics.open}
            subtitle={`${metrics.critical} critical cases`}
            icon={<Gavel className="h-6 w-6" />}
            tone={
              metrics.critical > 0 ? "red" : "cyan"
            }
          />

          <MetricCard
            title="Disputed Value"
            value={formatCurrency(
              metrics.disputedValue,
            )}
            subtitle="Value across active disputes"
            icon={
              <CircleDollarSign className="h-6 w-6" />
            }
            tone="amber"
          />

          <MetricCard
            title="Escalated Cases"
            value={metrics.escalated}
            subtitle="Supervisor review required"
            icon={
              <ShieldAlert className="h-6 w-6" />
            }
            tone="red"
          />

          <MetricCard
            title="Refund Requests"
            value={formatCurrency(
              metrics.refundedValue,
            )}
            subtitle="Approved refund value"
            icon={<RotateCcw className="h-6 w-6" />}
            tone="purple"
          />

          <MetricCard
            title="Resolution Rate"
            value={`${metrics.resolutionRate.toFixed(
              1,
            )}%`}
            subtitle={`${metrics.resolved} resolved cases`}
            icon={
              <ShieldCheck className="h-6 w-6" />
            }
            tone="green"
          />
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.4fr]">
          <article className="overflow-hidden rounded-[2rem] border border-white/[0.07] bg-slate-950/60 shadow-2xl shadow-black/25 backdrop-blur-2xl">
            <div className="border-b border-white/[0.06] p-5 sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-xl font-black">
                    <FileSearch className="h-5 w-5 text-emerald-300" />
                    Dispute case queue
                  </h2>

                  <p className="mt-2 text-sm text-slate-500">
                    Review cases by priority, category and
                    operational status.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm("");
                    setStatusFilter("all");
                    setPriorityFilter("all");
                    setTypeFilter("all");
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm font-black text-slate-300"
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
                    placeholder="Search case, passenger, driver, booking or ride..."
                    className="h-12 w-full rounded-2xl border border-white/[0.08] bg-slate-900/70 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400/40"
                  />
                </label>

                <label className="relative">
                  <select
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(
                        event.target
                          .value as StatusFilter,
                      )
                    }
                    className="h-12 min-w-44 appearance-none rounded-2xl border border-white/[0.08] bg-slate-900/70 px-4 pr-10 text-sm font-black text-slate-300 outline-none"
                  >
                    <option value="all">
                      All status
                    </option>

                    {Object.entries(STATUS_LABELS).map(
                      ([value, label]) => (
                        <option
                          key={value}
                          value={value}
                        >
                          {label}
                        </option>
                      ),
                    )}
                  </select>

                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </label>

                <label className="relative">
                  <select
                    value={priorityFilter}
                    onChange={(event) =>
                      setPriorityFilter(
                        event.target
                          .value as PriorityFilter,
                      )
                    }
                    className="h-12 min-w-40 appearance-none rounded-2xl border border-white/[0.08] bg-slate-900/70 px-4 pr-10 text-sm font-black text-slate-300 outline-none"
                  >
                    <option value="all">
                      All priority
                    </option>

                    {Object.entries(PRIORITY_LABELS).map(
                      ([value, label]) => (
                        <option
                          key={value}
                          value={value}
                        >
                          {label}
                        </option>
                      ),
                    )}
                  </select>

                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </label>

                <label className="relative">
                  <select
                    value={typeFilter}
                    onChange={(event) =>
                      setTypeFilter(
                        event.target.value as TypeFilter,
                      )
                    }
                    className="h-12 min-w-48 appearance-none rounded-2xl border border-white/[0.08] bg-slate-900/70 px-4 pr-10 text-sm font-black text-slate-300 outline-none"
                  >
                    <option value="all">
                      All dispute types
                    </option>

                    {Object.entries(TYPE_LABELS).map(
                      ([value, label]) => (
                        <option
                          key={value}
                          value={value}
                        >
                          {label}
                        </option>
                      ),
                    )}
                  </select>

                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </label>
              </div>
            </div>

            <div className="max-h-[1050px] overflow-y-auto">
              {loading ? (
                <div className="flex min-h-96 flex-col items-center justify-center">
                  <Loader2 className="h-10 w-10 animate-spin text-emerald-300" />

                  <p className="mt-4 font-black text-slate-300">
                    Loading disputes...
                  </p>
                </div>
              ) : filteredDisputes.length === 0 ? (
                <div className="flex min-h-96 flex-col items-center justify-center px-6 text-center">
                  <Scale className="h-12 w-12 text-emerald-300" />

                  <p className="mt-4 text-lg font-black">
                    No disputes found
                  </p>

                  <p className="mt-2 max-w-md text-sm text-slate-500">
                    No cases match the current filters.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.05]">
                  {filteredDisputes.map((dispute) => {
                    const caseNumber =
                      dispute.caseNumber ||
                      generateCaseNumber(dispute.id);

                    return (
                      <button
                        key={dispute.id}
                        type="button"
                        onClick={() =>
                          setSelectedDispute(dispute)
                        }
                        className="group w-full p-5 text-left transition hover:bg-white/[0.025] sm:p-6"
                      >
                        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
                                  PRIORITY_STYLES[
                                    dispute.priority
                                  ]
                                }`}
                              >
                                {
                                  PRIORITY_LABELS[
                                    dispute.priority
                                  ]
                                }
                              </span>

                              <span
                                className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
                                  STATUS_STYLES[
                                    dispute.status
                                  ]
                                }`}
                              >
                                {
                                  STATUS_LABELS[
                                    dispute.status
                                  ]
                                }
                              </span>

                              <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-violet-300">
                                {
                                  TYPE_LABELS[
                                    dispute.type
                                  ]
                                }
                              </span>

                              {dispute.refundRequested && (
                                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-300">
                                  Refund pending
                                </span>
                              )}
                            </div>

                            <div className="mt-3 flex items-start gap-3">
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-500/15 bg-emerald-500/10">
                                <Gavel className="h-5 w-5 text-emerald-300" />
                              </div>

                              <div className="min-w-0">
                                <h3 className="truncate text-base font-black group-hover:text-emerald-300 sm:text-lg">
                                  {dispute.title ||
                                    dispute.reason ||
                                    TYPE_LABELS[
                                      dispute.type
                                    ]}
                                </h3>

                                <p className="mt-1 font-mono text-xs font-black text-slate-500">
                                  {caseNumber}
                                </p>
                              </div>
                            </div>

                            <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-400">
                              {dispute.description ||
                                dispute.reason ||
                                "No dispute description provided."}
                            </p>

                            <div className="mt-4 grid gap-3 sm:grid-cols-4">
                              <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
                                <p className="text-[10px] font-black uppercase text-slate-600">
                                  Passenger
                                </p>

                                <p className="mt-1 truncate text-sm font-black">
                                  {dispute.passengerName ||
                                    dispute.passengerEmail ||
                                    "Unknown"}
                                </p>
                              </div>

                              <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
                                <p className="text-[10px] font-black uppercase text-slate-600">
                                  Driver
                                </p>

                                <p className="mt-1 truncate text-sm font-black">
                                  {dispute.driverName ||
                                    dispute.driverEmail ||
                                    "Unknown"}
                                </p>
                              </div>

                              <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
                                <p className="text-[10px] font-black uppercase text-slate-600">
                                  Amount
                                </p>

                                <p className="mt-1 text-sm font-black text-amber-300">
                                  {formatCurrency(
                                    Math.max(
                                      safeNumber(
                                        dispute.disputedAmount,
                                      ),
                                      safeNumber(
                                        dispute.amount,
                                      ),
                                    ),
                                    dispute.currency,
                                  )}
                                </p>
                              </div>

                              <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
                                <p className="text-[10px] font-black uppercase text-slate-600">
                                  Assigned
                                </p>

                                <p className="mt-1 truncate text-sm font-black">
                                  {dispute.assignedAgentName ||
                                    dispute.assignedAgentEmail ||
                                    "Unassigned"}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0">
                            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                              Last updated
                            </p>

                            <p className="mt-2 text-sm font-black text-slate-300">
                              {formatRelative(
                                dispute.updatedAt ||
                                  dispute.createdAt,
                              )}
                            </p>

                            <p className="mt-4 text-xs text-slate-600">
                              Ride
                            </p>

                            <p className="mt-1 max-w-44 truncate text-sm font-black text-slate-300">
                              {dispute.routeFrom &&
                              dispute.routeTo
                                ? `${dispute.routeFrom} → ${dispute.routeTo}`
                                : dispute.rideId ||
                                  "Not available"}
                            </p>

                            <span className="mt-4 inline-flex items-center gap-1 text-xs font-black text-emerald-300">
                              Open case
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </article>

          <aside className="space-y-6">
            <article className="rounded-[2rem] border border-white/[0.07] bg-slate-950/60 p-5 shadow-2xl shadow-black/25 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black">
                    Priority cases
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Cases requiring immediate attention
                  </p>
                </div>

                <ShieldAlert className="h-6 w-6 text-red-300" />
              </div>

              <div className="mt-5 space-y-3">
                {topPriorityCases.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/[0.08] p-6 text-center">
                    <ShieldCheck className="mx-auto h-8 w-8 text-emerald-300" />

                    <p className="mt-3 text-sm font-black text-slate-300">
                      No active priority cases
                    </p>
                  </div>
                ) : (
                  topPriorityCases.map(
                    (dispute, index) => (
                      <button
                        key={dispute.id}
                        type="button"
                        onClick={() =>
                          setSelectedDispute(dispute)
                        }
                        className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3 text-left"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-sm font-black">
                          {index + 1}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-black">
                            {dispute.caseNumber ||
                              generateCaseNumber(
                                dispute.id,
                              )}
                          </p>

                          <p className="mt-1 truncate text-xs text-slate-500">
                            {dispute.title ||
                              TYPE_LABELS[
                                dispute.type
                              ]}
                          </p>
                        </div>

                        <span
                          className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase ${
                            PRIORITY_STYLES[
                              dispute.priority
                            ]
                          }`}
                        >
                          {
                            PRIORITY_LABELS[
                              dispute.priority
                            ]
                          }
                        </span>
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
                    Resolution intelligence
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Enterprise case-management controls
                  </p>
                </div>

                <Sparkles className="h-6 w-6 text-emerald-300" />
              </div>

              <div className="mt-5 space-y-3">
                <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.06] p-4">
                  <p className="flex items-center gap-2 text-sm font-black text-emerald-300">
                    <BadgeCheck className="h-4 w-4" />
                    Complete audit trail
                  </p>

                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    Status, assignment, refund and
                    resolution actions generate audit
                    records.
                  </p>
                </div>

                <div className="rounded-2xl border border-violet-500/15 bg-violet-500/[0.06] p-4">
                  <p className="flex items-center gap-2 text-sm font-black text-violet-300">
                    <UsersRound className="h-4 w-4" />
                    Agent assignment
                  </p>

                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    Assign disputes to support agents,
                    managers or administrators.
                  </p>
                </div>

                <div className="rounded-2xl border border-cyan-500/15 bg-cyan-500/[0.06] p-4">
                  <p className="flex items-center gap-2 text-sm font-black text-cyan-300">
                    <RotateCcw className="h-4 w-4" />
                    Controlled refunds
                  </p>

                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    Refund actions create secure pending
                    requests for server-side payment
                    processing.
                  </p>
                </div>
              </div>
            </article>
          </aside>
        </section>
      </div>

      {selectedDispute && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-md sm:items-center sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-label="Dispute details"
        >
          <button
            type="button"
            onClick={() =>
              setSelectedDispute(null)
            }
            className="absolute inset-0"
            aria-label="Close dispute"
          />

          <div className="relative z-10 max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-t-[2rem] border border-white/[0.08] bg-[#030712] shadow-2xl shadow-black sm:rounded-[2rem]">
            <div className="sticky top-0 z-20 flex items-center justify-between border-b border-white/[0.06] bg-[#030712]/95 p-5 backdrop-blur-xl sm:p-6">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
                      PRIORITY_STYLES[
                        selectedDispute.priority
                      ]
                    }`}
                  >
                    {
                      PRIORITY_LABELS[
                        selectedDispute.priority
                      ]
                    }
                  </span>

                  <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
                      STATUS_STYLES[
                        selectedDispute.status
                      ]
                    }`}
                  >
                    {
                      STATUS_LABELS[
                        selectedDispute.status
                      ]
                    }
                  </span>

                  <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-violet-300">
                    {
                      TYPE_LABELS[
                        selectedDispute.type
                      ]
                    }
                  </span>
                </div>

                <h2 className="mt-3 truncate text-xl font-black sm:text-2xl">
                  {selectedDispute.title ||
                    selectedDispute.reason ||
                    TYPE_LABELS[
                      selectedDispute.type
                    ]}
                </h2>

                <p className="mt-1 font-mono text-xs font-black text-slate-500">
                  {selectedDispute.caseNumber ||
                    generateCaseNumber(
                      selectedDispute.id,
                    )}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedDispute(null)
                }
                className="ml-4 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-slate-400"
                aria-label="Close dispute"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 sm:p-7">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  title="Disputed Amount"
                  value={formatCurrency(
                    Math.max(
                      safeNumber(
                        selectedDispute.disputedAmount,
                      ),
                      safeNumber(
                        selectedDispute.amount,
                      ),
                    ),
                    selectedDispute.currency,
                  )}
                  subtitle="Amount under review"
                  icon={
                    <CircleDollarSign className="h-6 w-6" />
                  }
                  tone="amber"
                />

                <MetricCard
                  title="Evidence"
                  value={
                    selectedDispute.evidence?.length ||
                    0
                  }
                  subtitle="Files and supporting records"
                  icon={
                    <FileImage className="h-6 w-6" />
                  }
                  tone="cyan"
                />

                <MetricCard
                  title="Assigned Agent"
                  value={
                    selectedDispute.assignedAgentName ||
                    selectedDispute.assignedAgentEmail ||
                    "Unassigned"
                  }
                  subtitle="Current case owner"
                  icon={
                    <UserRoundCog className="h-6 w-6" />
                  }
                  tone="purple"
                />

                <MetricCard
                  title="Case Age"
                  value={formatRelative(
                    selectedDispute.createdAt,
                  )}
                  subtitle="Time since case creation"
                  icon={<Clock3 className="h-6 w-6" />}
                  tone="green"
                />
              </div>

              <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.72fr]">
                <div className="space-y-5">
                  <section className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-5">
                    <h3 className="flex items-center gap-2 font-black">
                      <AlertTriangle className="h-5 w-5 text-amber-300" />
                      Dispute summary
                    </h3>

                    <p className="mt-4 text-sm leading-7 text-slate-300">
                      {selectedDispute.description ||
                        selectedDispute.reason ||
                        "No detailed dispute description was provided."}
                    </p>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/[0.05] bg-slate-950/50 p-4">
                        <p className="text-xs font-black uppercase text-slate-600">
                          Reason
                        </p>

                        <p className="mt-2 text-sm font-black text-slate-200">
                          {selectedDispute.reason ||
                            "Not specified"}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-white/[0.05] bg-slate-950/50 p-4">
                        <p className="text-xs font-black uppercase text-slate-600">
                          Reporter
                        </p>

                        <p className="mt-2 text-sm font-black text-slate-200">
                          {selectedDispute.reporterEmail ||
                            selectedDispute.reporterId ||
                            "Unknown"}
                        </p>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-5">
                    <h3 className="flex items-center gap-2 font-black">
                      <UsersRound className="h-5 w-5 text-violet-300" />
                      Participants
                    </h3>

                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/[0.05] bg-slate-950/50 p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300">
                            <UserRound className="h-5 w-5" />
                          </div>

                          <div className="min-w-0">
                            <p className="text-xs font-black uppercase text-slate-600">
                              Passenger
                            </p>

                            <p className="mt-1 truncate text-sm font-black">
                              {selectedDispute.passengerName ||
                                selectedDispute.passengerEmail ||
                                selectedDispute.passengerId ||
                                "Unknown"}
                            </p>
                          </div>
                        </div>

                        <p className="mt-3 break-all text-xs text-slate-500">
                          {selectedDispute.passengerEmail ||
                            selectedDispute.passengerId ||
                            "No contact information"}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-white/[0.05] bg-slate-950/50 p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-300">
                            <UserRoundCheck className="h-5 w-5" />
                          </div>

                          <div className="min-w-0">
                            <p className="text-xs font-black uppercase text-slate-600">
                              Driver
                            </p>

                            <p className="mt-1 truncate text-sm font-black">
                              {selectedDispute.driverName ||
                                selectedDispute.driverEmail ||
                                selectedDispute.driverId ||
                                "Unknown"}
                            </p>
                          </div>
                        </div>

                        <p className="mt-3 break-all text-xs text-slate-500">
                          {selectedDispute.driverEmail ||
                            selectedDispute.driverId ||
                            "No contact information"}
                        </p>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-5">
                    <h3 className="flex items-center gap-2 font-black">
                      <FileImage className="h-5 w-5 text-cyan-300" />
                      Evidence
                    </h3>

                    <div className="mt-5 space-y-3">
                      {selectedDispute.evidence?.length ? (
                        selectedDispute.evidence.map(
                          (evidence, index) => (
                            <div
                              key={
                                evidence.id ||
                                `${evidence.label}-${index}`
                              }
                              className="flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-slate-950/50 p-4"
                            >
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-500/15 bg-cyan-500/10 text-cyan-300">
                                {evidenceIcon(
                                  evidence.type,
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-black text-slate-200">
                                  {evidence.label ||
                                    evidence.type ||
                                    `Evidence ${
                                      index + 1
                                    }`}
                                </p>

                                <p className="mt-1 text-xs leading-5 text-slate-500">
                                  {evidence.description ||
                                    `Uploaded by ${
                                      evidence.uploadedBy ||
                                      "unknown"
                                    }`}
                                </p>

                                {evidence.url && (
                                  <a
                                    href={evidence.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-2 inline-flex items-center gap-1 text-xs font-black text-cyan-300 hover:text-cyan-200"
                                  >
                                    Open evidence
                                    <ArrowUpRight className="h-3.5 w-3.5" />
                                  </a>
                                )}
                              </div>

                              <span className="shrink-0 text-[10px] font-bold text-slate-600">
                                {formatRelative(
                                  evidence.createdAt,
                                )}
                              </span>
                            </div>
                          ),
                        )
                      ) : (
                        <div className="rounded-2xl border border-dashed border-white/[0.08] p-6 text-center">
                          <FileSearch className="mx-auto h-8 w-8 text-slate-600" />

                          <p className="mt-3 text-sm font-black text-slate-400">
                            No evidence attached
                          </p>
                        </div>
                      )}
                    </div>
                  </section>

                  <section className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-5">
                    <h3 className="flex items-center gap-2 font-black">
                      <History className="h-5 w-5 text-violet-300" />
                      Case timeline
                    </h3>

                    <div className="relative mt-6 space-y-5 before:absolute before:bottom-2 before:left-[9px] before:top-2 before:w-px before:bg-white/[0.08]">
                      {selectedDispute.timeline?.length ? (
                        [...selectedDispute.timeline]
                          .sort(
                            (first, second) =>
                              getTime(
                                second.createdAt,
                              ) -
                              getTime(
                                first.createdAt,
                              ),
                          )
                          .map((item, index) => (
                            <div
                              key={
                                item.id ||
                                `${item.action}-${index}`
                              }
                              className="relative flex gap-4"
                            >
                              <span className="relative z-10 mt-1 h-[19px] w-[19px] shrink-0 rounded-full border-4 border-[#030712] bg-violet-400" />

                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-black text-slate-200">
                                  {item.action ||
                                    "Case update"}
                                </p>

                                <p className="mt-1 text-xs leading-5 text-slate-500">
                                  {item.description ||
                                    "No description"}
                                </p>

                                <p className="mt-1 text-[11px] font-bold text-slate-600">
                                  {item.actorEmail ||
                                    "System"}{" "}
                                  ·{" "}
                                  {formatRelative(
                                    item.createdAt,
                                  )}
                                </p>
                              </div>
                            </div>
                          ))
                      ) : (
                        <div className="rounded-2xl border border-dashed border-white/[0.08] p-5 text-center text-sm text-slate-500">
                          Timeline entries will appear
                          after case actions.
                        </div>
                      )}
                    </div>
                  </section>
                </div>

                <div className="space-y-5">
                  <section className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-5">
                    <h3 className="flex items-center gap-2 font-black">
                      <UserRoundCog className="h-5 w-5 text-violet-300" />
                      Agent assignment
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Assign this dispute to a support
                      agent or administrator.
                    </p>

                    <label className="relative mt-4 block">
                      <select
                        value={
                          selectedDispute.assignedAgentId ||
                          ""
                        }
                        onChange={(event) =>
                          assignAgent(
                            selectedDispute,
                            event.target.value,
                          )
                        }
                        disabled={
                          updatingDisputeId ===
                          selectedDispute.id
                        }
                        className="h-12 w-full appearance-none rounded-xl border border-white/[0.08] bg-slate-900/70 px-4 pr-10 text-sm font-black text-slate-300 outline-none disabled:opacity-50"
                      >
                        <option value="">
                          Unassigned
                        </option>

                        {agents.map((agent) => (
                          <option
                            key={agent.id}
                            value={agent.id}
                          >
                            {agent.name ||
                              agent.email ||
                              agent.id}
                          </option>
                        ))}
                      </select>

                      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    </label>
                  </section>

                  <section className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-5">
                    <h3 className="flex items-center gap-2 font-black">
                      <MessageSquareText className="h-5 w-5 text-cyan-300" />
                      Case communication
                    </h3>

                    <label className="mt-4 block">
                      <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-600">
                        Internal notes
                      </span>

                      <textarea
                        value={internalNote}
                        onChange={(event) =>
                          setInternalNote(
                            event.target.value,
                          )
                        }
                        rows={5}
                        placeholder="Add private notes for RoadLink administrators..."
                        className="mt-2 w-full resize-none rounded-xl border border-white/[0.08] bg-slate-900/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400/40"
                      />
                    </label>

                    <label className="mt-4 block">
                      <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-600">
                        Customer message
                      </span>

                      <textarea
                        value={customerMessage}
                        onChange={(event) =>
                          setCustomerMessage(
                            event.target.value,
                          )
                        }
                        rows={4}
                        placeholder="Write an update for the passenger..."
                        className="mt-2 w-full resize-none rounded-xl border border-white/[0.08] bg-slate-900/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400/40"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() =>
                        saveCaseNotes(selectedDispute)
                      }
                      disabled={
                        updatingDisputeId ===
                        selectedDispute.id
                      }
                      className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 text-sm font-black text-cyan-200 disabled:opacity-50"
                    >
                      {updatingDisputeId ===
                      selectedDispute.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <MessageSquareText className="h-4 w-4" />
                      )}

                      Save notes and message
                    </button>
                  </section>

                  <section className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-5">
                    <h3 className="flex items-center gap-2 font-black">
                      <Gavel className="h-5 w-5 text-amber-300" />
                      Resolution controls
                    </h3>

                    <label className="mt-4 block">
                      <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-600">
                        Resolution summary
                      </span>

                      <textarea
                        value={resolutionText}
                        onChange={(event) =>
                          setResolutionText(
                            event.target.value,
                          )
                        }
                        rows={4}
                        placeholder="Document the final case decision..."
                        className="mt-2 w-full resize-none rounded-xl border border-white/[0.08] bg-slate-900/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400/40"
                      />
                    </label>

                    <div className="mt-4 grid gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          updateDisputeStatus(
                            selectedDispute,
                            "under_review",
                          )
                        }
                        disabled={
                          updatingDisputeId ===
                            selectedDispute.id ||
                          selectedDispute.status ===
                            "under_review"
                        }
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 text-sm font-black text-amber-200 disabled:opacity-50"
                      >
                        <FileSearch className="h-4 w-4" />
                        Start investigation
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          updateDisputeStatus(
                            selectedDispute,
                            "awaiting_evidence",
                          )
                        }
                        disabled={
                          updatingDisputeId ===
                            selectedDispute.id ||
                          selectedDispute.status ===
                            "awaiting_evidence"
                        }
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-violet-500/20 bg-violet-500/10 px-4 text-sm font-black text-violet-200 disabled:opacity-50"
                      >
                        <FileImage className="h-4 w-4" />
                        Request more evidence
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          updateDisputeStatus(
                            selectedDispute,
                            "escalated",
                          )
                        }
                        disabled={
                          updatingDisputeId ===
                            selectedDispute.id ||
                          selectedDispute.status ===
                            "escalated"
                        }
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 text-sm font-black text-red-200 disabled:opacity-50"
                      >
                        <ShieldAlert className="h-4 w-4" />
                        Escalate to supervisor
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          updateDisputeStatus(
                            selectedDispute,
                            "approved",
                            resolutionText,
                          )
                        }
                        disabled={
                          updatingDisputeId ===
                          selectedDispute.id
                        }
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 text-sm font-black text-slate-950 disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Approve dispute
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          updateDisputeStatus(
                            selectedDispute,
                            "rejected",
                            resolutionText,
                          )
                        }
                        disabled={
                          updatingDisputeId ===
                          selectedDispute.id
                        }
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-orange-500/20 bg-orange-500/10 px-4 text-sm font-black text-orange-200 disabled:opacity-50"
                      >
                        <XCircle className="h-4 w-4" />
                        Reject dispute
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          updateDisputeStatus(
                            selectedDispute,
                            "closed",
                            resolutionText,
                          )
                        }
                        disabled={
                          updatingDisputeId ===
                          selectedDispute.id
                        }
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-500/20 bg-slate-500/10 px-4 text-sm font-black text-slate-300 disabled:opacity-50"
                      >
                        <ShieldCheck className="h-4 w-4" />
                        Close case
                      </button>
                    </div>
                  </section>

                  <section className="rounded-3xl border border-emerald-500/15 bg-emerald-500/[0.06] p-5">
                    <h3 className="flex items-center gap-2 font-black text-emerald-200">
                      <Banknote className="h-5 w-5" />
                      Refund controls
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Refund requests are recorded for
                      secure server-side payment
                      processing.
                    </p>

                    <label className="mt-4 block">
                      <span className="text-xs font-black uppercase tracking-[0.14em] text-emerald-400/70">
                        Partial refund amount
                      </span>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={refundAmount}
                        onChange={(event) =>
                          setRefundAmount(
                            safeNumber(
                              event.target.value,
                            ),
                          )
                        }
                        className="mt-2 h-12 w-full rounded-xl border border-emerald-500/15 bg-slate-950/60 px-4 text-sm text-white outline-none focus:border-emerald-400/40"
                      />
                    </label>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() =>
                          requestRefund(
                            selectedDispute,
                            "partial",
                          )
                        }
                        disabled={
                          updatingDisputeId ===
                            selectedDispute.id ||
                          selectedDispute.refundRequested
                        }
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 text-sm font-black text-emerald-200 disabled:opacity-50"
                      >
                        <WalletCards className="h-4 w-4" />
                        Partial refund
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          requestRefund(
                            selectedDispute,
                            "full",
                          )
                        }
                        disabled={
                          updatingDisputeId ===
                            selectedDispute.id ||
                          selectedDispute.refundRequested
                        }
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 text-sm font-black text-slate-950 disabled:opacity-50"
                      >
                        {updatingDisputeId ===
                        selectedDispute.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RotateCcw className="h-4 w-4" />
                        )}

                        Full refund
                      </button>
                    </div>

                    {selectedDispute.refundRequested && (
                      <div className="mt-4 rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.08] p-4">
                        <p className="flex items-center gap-2 text-sm font-black text-emerald-300">
                          <CheckCircle2 className="h-4 w-4" />
                          Refund request pending
                        </p>

                        <p className="mt-2 text-xs leading-5 text-emerald-100/70">
                          {formatCurrency(
                            safeNumber(
                              selectedDispute.refundAmount,
                            ),
                            selectedDispute.currency,
                          )}{" "}
                          {selectedDispute.refundType ||
                            ""}{" "}
                          refund is awaiting payment
                          processing.
                        </p>
                      </div>
                    )}
                  </section>

                  <section className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-5">
                    <h3 className="font-black">
                      Transaction and ride data
                    </h3>

                    <dl className="mt-4 space-y-4">
                      {[
                        [
                          "Ride ID",
                          selectedDispute.rideId,
                        ],
                        [
                          "Booking ID",
                          selectedDispute.bookingId,
                        ],
                        [
                          "Route",
                          selectedDispute.routeFrom &&
                          selectedDispute.routeTo
                            ? `${selectedDispute.routeFrom} → ${selectedDispute.routeTo}`
                            : null,
                        ],
                        [
                          "Ride date",
                          formatDate(
                            selectedDispute.rideDate,
                          ),
                        ],
                        [
                          "Payment status",
                          selectedDispute.paymentStatus,
                        ],
                        [
                          "Payment Intent",
                          selectedDispute.paymentIntentId,
                        ],
                        [
                          "Created",
                          formatDate(
                            selectedDispute.createdAt,
                          ),
                        ],
                        [
                          "Updated",
                          formatDate(
                            selectedDispute.updatedAt ||
                              selectedDispute.createdAt,
                          ),
                        ],
                      ].map(([label, value]) => (
                        <div
                          key={String(label)}
                          className="flex items-start justify-between gap-4 border-b border-white/[0.05] pb-3 last:border-0 last:pb-0"
                        >
                          <dt className="text-sm text-slate-500">
                            {label}
                          </dt>

                          <dd className="max-w-[60%] break-all text-right text-sm font-black text-slate-200">
                            {value || "Not available"}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
  }
