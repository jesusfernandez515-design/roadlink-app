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
  addDoc,
  collection,
  deleteDoc,
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
  AlertTriangle,
  BadgePercent,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Copy,
  Gift,
  Loader2,
  Megaphone,
  Pencil,
  Plus,
  RefreshCcw,
  Route,
  Save,
  Search,
  Sparkles,
  Tag,
  Target,
  TicketPercent,
  ToggleLeft,
  ToggleRight,
  Trash2,
  TrendingUp,
  UsersRound,
  X,
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

type DiscountType = "percentage" | "fixed";
type PromotionStatus = "active" | "scheduled" | "expired" | "disabled";
type PromotionAudience =
  | "all"
  | "new_users"
  | "passengers"
  | "drivers";
type PromotionFilter =
  | "all"
  | PromotionStatus;

type PromotionItem = {
  id: string;
  name: string;
  code: string;
  description?: string;
  discountType: DiscountType;
  discountValue: number;
  minimumPurchase: number;
  maximumDiscount?: number;
  startDate?: TimestampLike;
  endDate?: TimestampLike;
  totalUsageLimit: number;
  usageLimitPerUser: number;
  usageCount: number;
  audience: PromotionAudience;
  routeFrom?: string;
  routeTo?: string;
  routeKey?: string;
  newUsersOnly: boolean;
  driversOnly: boolean;
  firstBookingOnly: boolean;
  enabled: boolean;
  automatic: boolean;
  status: PromotionStatus;
  estimatedRevenue: number;
  recoveredRevenue: number;
  discountCost: number;
  conversionRate: number;
  createdAt?: TimestampLike;
  updatedAt?: TimestampLike;
  createdBy?: string;
  updatedBy?: string;
};

type PromotionUsage = {
  id: string;
  promotionId?: string;
  promotionCode?: string;
  userId?: string;
  userEmail?: string;
  bookingId?: string;
  rideId?: string;
  originalAmount?: number;
  discountAmount?: number;
  finalAmount?: number;
  status?: string;
  createdAt?: TimestampLike;
};

type BookingItem = {
  id: string;
  price?: number;
  amount?: number;
  status?: string;
  discountAmount?: number;
  promotionCode?: string;
  couponCode?: string;
  createdAt?: TimestampLike;
};

type PromotionForm = {
  id?: string;
  name: string;
  code: string;
  description: string;
  discountType: DiscountType;
  discountValue: number;
  minimumPurchase: number;
  maximumDiscount: number;
  startDate: string;
  endDate: string;
  totalUsageLimit: number;
  usageLimitPerUser: number;
  audience: PromotionAudience;
  routeFrom: string;
  routeTo: string;
  firstBookingOnly: boolean;
  enabled: boolean;
  automatic: boolean;
};

const EMPTY_FORM: PromotionForm = {
  name: "",
  code: "",
  description: "",
  discountType: "percentage",
  discountValue: 10,
  minimumPurchase: 0,
  maximumDiscount: 25,
  startDate: "",
  endDate: "",
  totalUsageLimit: 100,
  usageLimitPerUser: 1,
  audience: "all",
  routeFrom: "",
  routeTo: "",
  firstBookingOnly: false,
  enabled: true,
  automatic: false,
};

const STATUS_LABELS: Record<PromotionStatus, string> = {
  active: "Active",
  scheduled: "Scheduled",
  expired: "Expired",
  disabled: "Disabled",
};

const STATUS_STYLES: Record<PromotionStatus, string> = {
  active:
    "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  scheduled:
    "border-cyan-500/25 bg-cyan-500/10 text-cyan-300",
  expired:
    "border-amber-500/25 bg-amber-500/10 text-amber-300",
  disabled:
    "border-slate-500/25 bg-slate-500/10 text-slate-300",
};

const AUDIENCE_LABELS: Record<PromotionAudience, string> = {
  all: "All users",
  new_users: "New users",
  passengers: "Passengers",
  drivers: "Drivers",
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

function normalizeCode(value?: string | null) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 32);
}

function normalizeStatus(value?: string | null) {
  return normalizeString(value).replace(/\s+/g, "_");
}

function clamp(
  value: number,
  minimum = 0,
  maximum = 100,
) {
  return Math.min(maximum, Math.max(minimum, value));
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function toDateInput(value: TimestampLike) {
  const date = toDate(value);

  if (!date) return "";

  const localDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000,
  );

  return localDate.toISOString().slice(0, 16);
}

function resolvePromotionStatus(
  promotion: Pick<
    PromotionItem,
    "enabled" | "startDate" | "endDate"
  >,
): PromotionStatus {
  if (!promotion.enabled) return "disabled";

  const now = Date.now();
  const startTime = getTime(promotion.startDate);
  const endTime = getTime(promotion.endDate);

  if (startTime && startTime > now) return "scheduled";
  if (endTime && endTime < now) return "expired";

  return "active";
}

function routeKey(from: string, to: string) {
  if (!from.trim() || !to.trim()) return "";

  return `${normalizeString(from)}__${normalizeString(to)}`;
}

function generateCode() {
  const prefix = "ROAD";
  const random = Math.random()
    .toString(36)
    .slice(2, 7)
    .toUpperCase();

  return `${prefix}${random}`;
}

function calculateDiscountPreview(
  promotion: PromotionForm,
  amount: number,
) {
  if (amount < promotion.minimumPurchase) return 0;

  if (promotion.discountType === "fixed") {
    return Math.min(
      promotion.discountValue,
      amount,
    );
  }

  const rawDiscount =
    amount * (promotion.discountValue / 100);

  if (promotion.maximumDiscount > 0) {
    return Math.min(
      rawDiscount,
      promotion.maximumDiscount,
      amount,
    );
  }

  return Math.min(rawDiscount, amount);
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

function FormField({
  label,
  children,
  description,
}: {
  label: string;
  children: ReactNode;
  description?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </span>

      <div className="mt-2">{children}</div>

      {description && (
        <p className="mt-1.5 text-xs leading-5 text-slate-600">
          {description}
        </p>
      )}
    </label>
  );
}

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<
    PromotionItem[]
  >([]);

  const [usageRecords, setUsageRecords] = useState<
    PromotionUsage[]
  >([]);

  const [bookings, setBookings] = useState<
    BookingItem[]
  >([]);

  const [form, setForm] =
    useState<PromotionForm>(EMPTY_FORM);

  const [selectedPromotion, setSelectedPromotion] =
    useState<PromotionItem | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [updatingId, setUpdatingId] = useState<
    string | null
  >(null);

  const [deletingId, setDeletingId] = useState<
    string | null
  >(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<PromotionFilter>("all");

  const [previewAmount, setPreviewAmount] =
    useState(50);

  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const unsubscribePromotions = onSnapshot(
      query(
        collection(db, "promotions"),
        orderBy("createdAt", "desc"),
        limit(500),
      ),
      (snapshot) => {
        const items = snapshot.docs.map(
          (document) => {
            const data = {
              id: document.id,
              ...document.data(),
            } as PromotionItem;

            return {
              ...data,
              status: resolvePromotionStatus(data),
            };
          },
        );

        setPromotions(items);
        setLoading(false);
      },
      (error) => {
        console.error(
          "Promotions listener failed:",
          error,
        );

        setErrorMessage(
          "RoadLink could not load promotions. Verify Firestore permissions.",
        );

        setLoading(false);
      },
    );

    const unsubscribeUsage = onSnapshot(
      query(
        collection(db, "promotionUsages"),
        orderBy("createdAt", "desc"),
        limit(1000),
      ),
      (snapshot) => {
        const items = snapshot.docs.map(
          (document) =>
            ({
              id: document.id,
              ...document.data(),
            }) as PromotionUsage,
        );

        setUsageRecords(items);
      },
      (error) => {
        console.error(
          "Promotion usage listener failed:",
          error,
        );
      },
    );

    const unsubscribeBookings = onSnapshot(
      query(
        collection(db, "bookings"),
        limit(2000),
      ),
      (snapshot) => {
        const items = snapshot.docs.map(
          (document) =>
            ({
              id: document.id,
              ...document.data(),
            }) as BookingItem,
        );

        setBookings(items);
      },
      (error) => {
        console.error(
          "Bookings listener failed:",
          error,
        );
      },
    );

    return () => {
      unsubscribePromotions();
      unsubscribeUsage();
      unsubscribeBookings();
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
        module: "promotions",
        action,
        description,
        entityId: entityId ?? null,
        metadata: metadata ?? {},
        actorId: auth.currentUser?.uid || "system",
        actorEmail:
          auth.currentUser?.email ||
          "promotions-engine@roadlink.system",
        createdAt: serverTimestamp(),
      });
    },
    [],
  );

  const createNotification = useCallback(
    async ({
      title,
      notificationMessage,
      severity = "medium",
      entityId,
    }: {
      title: string;
      notificationMessage: string;
      severity?:
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
        type: "promotion_update",
        severity,
        audience: "admin",
        entityId: entityId ?? null,
        read: false,
        createdAt: serverTimestamp(),
        createdBy:
          auth.currentUser?.email ||
          "promotions-engine",
      });
    },
    [],
  );

  function updateForm<K extends keyof PromotionForm>(
    key: K,
    value: PromotionForm[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function openCreateForm() {
    setForm({
      ...EMPTY_FORM,
      code: generateCode(),
    });

    setSelectedPromotion(null);
    setShowForm(true);
    setMessage("");
    setErrorMessage("");
  }

  function openEditForm(promotion: PromotionItem) {
    setForm({
      id: promotion.id,
      name: promotion.name,
      code: promotion.code,
      description: promotion.description || "",
      discountType: promotion.discountType,
      discountValue: safeNumber(
        promotion.discountValue,
      ),
      minimumPurchase: safeNumber(
        promotion.minimumPurchase,
      ),
      maximumDiscount: safeNumber(
        promotion.maximumDiscount,
      ),
      startDate: toDateInput(promotion.startDate),
      endDate: toDateInput(promotion.endDate),
      totalUsageLimit: safeNumber(
        promotion.totalUsageLimit,
      ),
      usageLimitPerUser: safeNumber(
        promotion.usageLimitPerUser,
      ),
      audience: promotion.audience,
      routeFrom: promotion.routeFrom || "",
      routeTo: promotion.routeTo || "",
      firstBookingOnly:
        promotion.firstBookingOnly || false,
      enabled: promotion.enabled,
      automatic: promotion.automatic,
    });

    setSelectedPromotion(promotion);
    setShowForm(true);
    setMessage("");
    setErrorMessage("");
  }

  const savePromotion = useCallback(async () => {
    setSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      const normalizedCode = normalizeCode(form.code);
      const normalizedName = form.name.trim();

      if (!normalizedName) {
        throw new Error(
          "Promotion name is required.",
        );
      }

      if (!normalizedCode) {
        throw new Error(
          "Promotion code is required.",
        );
      }

      if (form.discountValue <= 0) {
        throw new Error(
          "Discount value must be greater than zero.",
        );
      }

      if (
        form.discountType === "percentage" &&
        form.discountValue > 100
      ) {
        throw new Error(
          "Percentage discount cannot exceed one hundred percent.",
        );
      }

      const duplicateCode = promotions.some(
        (promotion) =>
          normalizeCode(promotion.code) ===
            normalizedCode &&
          promotion.id !== form.id,
      );

      if (duplicateCode) {
        throw new Error(
          "A promotion with this code already exists.",
        );
      }

      const startDate = form.startDate
        ? new Date(form.startDate)
        : null;

      const endDate = form.endDate
        ? new Date(form.endDate)
        : null;

      if (
        startDate &&
        endDate &&
        endDate.getTime() <= startDate.getTime()
      ) {
        throw new Error(
          "Expiration date must be after the start date.",
        );
      }

      const payload = {
        name: normalizedName,
        code: normalizedCode,
        description: form.description.trim(),
        discountType: form.discountType,
        discountValue: safeNumber(
          form.discountValue,
        ),
        minimumPurchase: Math.max(
          safeNumber(form.minimumPurchase),
          0,
        ),
        maximumDiscount:
          form.discountType === "percentage"
            ? Math.max(
                safeNumber(form.maximumDiscount),
                0,
              )
            : safeNumber(form.discountValue),
        startDate: startDate
          ? startDate.toISOString()
          : null,
        endDate: endDate
          ? endDate.toISOString()
          : null,
        totalUsageLimit: Math.max(
          safeNumber(form.totalUsageLimit),
          0,
        ),
        usageLimitPerUser: Math.max(
          safeNumber(form.usageLimitPerUser),
          1,
        ),
        audience: form.audience,
        routeFrom: form.routeFrom.trim(),
        routeTo: form.routeTo.trim(),
        routeKey: routeKey(
          form.routeFrom,
          form.routeTo,
        ),
        newUsersOnly:
          form.audience === "new_users",
        driversOnly:
          form.audience === "drivers",
        firstBookingOnly:
          form.firstBookingOnly,
        enabled: form.enabled,
        automatic: form.automatic,
        status: resolvePromotionStatus({
          enabled: form.enabled,
          startDate,
          endDate,
        }),
        updatedAt: serverTimestamp(),
        updatedBy:
          auth.currentUser?.email ||
          "RoadLink Admin",
      };

      let promotionId = form.id;

      if (form.id) {
        await updateDoc(
          doc(db, "promotions", form.id),
          payload,
        );

        await createAuditLog({
          action: "PROMOTION_UPDATED",
          description: `Promotion ${normalizedCode} was updated.`,
          entityId: form.id,
          metadata: {
            code: normalizedCode,
            discountType: form.discountType,
            discountValue: form.discountValue,
            audience: form.audience,
          },
        });
      } else {
        const reference = await addDoc(
          collection(db, "promotions"),
          {
            ...payload,
            usageCount: 0,
            estimatedRevenue: 0,
            recoveredRevenue: 0,
            discountCost: 0,
            conversionRate: 0,
            createdAt: serverTimestamp(),
            createdBy:
              auth.currentUser?.email ||
              "RoadLink Admin",
          },
        );

        promotionId = reference.id;

        await updateDoc(reference, {
          id: reference.id,
        });

        await createAuditLog({
          action: "PROMOTION_CREATED",
          description: `Promotion ${normalizedCode} was created.`,
          entityId: reference.id,
          metadata: {
            code: normalizedCode,
            discountType: form.discountType,
            discountValue: form.discountValue,
            audience: form.audience,
          },
        });

        await createNotification({
          title: "New promotion created",
          notificationMessage: `${normalizedCode} is ready for RoadLink customers.`,
          severity: "low",
          entityId: reference.id,
        });
      }

      setShowForm(false);
      setSelectedPromotion(null);
      setForm(EMPTY_FORM);

      setMessage(
        form.id
          ? `${normalizedCode} updated successfully.`
          : `${normalizedCode} created successfully.`,
      );

      if (promotionId) {
        setTimeout(() => {
          const item = promotions.find(
            (promotion) =>
              promotion.id === promotionId,
          );

          if (item) {
            setSelectedPromotion(item);
          }
        }, 500);
      }
    } catch (error) {
      console.error("Save promotion failed:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "RoadLink could not save this promotion.",
      );
    } finally {
      setSaving(false);
    }
  }, [
    createAuditLog,
    createNotification,
    form,
    promotions,
  ]);

  const togglePromotion = useCallback(
    async (promotion: PromotionItem) => {
      setUpdatingId(promotion.id);
      setMessage("");
      setErrorMessage("");

      try {
        const enabled = !promotion.enabled;

        await updateDoc(
          doc(db, "promotions", promotion.id),
          {
            enabled,
            status: resolvePromotionStatus({
              enabled,
              startDate: promotion.startDate,
              endDate: promotion.endDate,
            }),
            updatedAt: serverTimestamp(),
            updatedBy:
              auth.currentUser?.email ||
              "RoadLink Admin",
          },
        );

        await createAuditLog({
          action: enabled
            ? "PROMOTION_ENABLED"
            : "PROMOTION_DISABLED",
          description: `${promotion.code} was ${
            enabled ? "enabled" : "disabled"
          }.`,
          entityId: promotion.id,
          metadata: {
            code: promotion.code,
            enabled,
          },
        });

        setMessage(
          `${promotion.code} ${
            enabled ? "enabled" : "disabled"
          } successfully.`,
        );
      } catch (error) {
        console.error(
          "Toggle promotion failed:",
          error,
        );

        setErrorMessage(
          "RoadLink could not change this promotion status.",
        );
      } finally {
        setUpdatingId(null);
      }
    },
    [createAuditLog],
  );

  const duplicatePromotion = useCallback(
    async (promotion: PromotionItem) => {
      setUpdatingId(promotion.id);
      setMessage("");
      setErrorMessage("");

      try {
        const duplicatedCode = normalizeCode(
          `${promotion.code}-${Math.random()
            .toString(36)
            .slice(2, 5)
            .toUpperCase()}`,
        );

        const reference = await addDoc(
          collection(db, "promotions"),
          {
            ...promotion,
            id: undefined,
            name: `${promotion.name} Copy`,
            code: duplicatedCode,
            enabled: false,
            automatic: false,
            status: "disabled",
            usageCount: 0,
            estimatedRevenue: 0,
            recoveredRevenue: 0,
            discountCost: 0,
            conversionRate: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy:
              auth.currentUser?.email ||
              "RoadLink Admin",
            updatedBy:
              auth.currentUser?.email ||
              "RoadLink Admin",
          },
        );

        await updateDoc(reference, {
          id: reference.id,
        });

        await createAuditLog({
          action: "PROMOTION_DUPLICATED",
          description: `${promotion.code} was duplicated as ${duplicatedCode}.`,
          entityId: reference.id,
          metadata: {
            sourcePromotionId: promotion.id,
            sourceCode: promotion.code,
            newCode: duplicatedCode,
          },
        });

        setMessage(
          `${promotion.code} duplicated as ${duplicatedCode}.`,
        );
      } catch (error) {
        console.error(
          "Duplicate promotion failed:",
          error,
        );

        setErrorMessage(
          "RoadLink could not duplicate this promotion.",
        );
      } finally {
        setUpdatingId(null);
      }
    },
    [createAuditLog],
  );

  const removePromotion = useCallback(
    async (promotion: PromotionItem) => {
      const confirmed = window.confirm(
        `Delete promotion ${promotion.code}? This action cannot be undone.`,
      );

      if (!confirmed) return;

      setDeletingId(promotion.id);
      setMessage("");
      setErrorMessage("");

      try {
        await deleteDoc(
          doc(db, "promotions", promotion.id),
        );

        await createAuditLog({
          action: "PROMOTION_DELETED",
          description: `${promotion.code} was deleted.`,
          entityId: promotion.id,
          metadata: {
            code: promotion.code,
            name: promotion.name,
          },
        });

        setSelectedPromotion(null);
        setMessage(
          `${promotion.code} deleted successfully.`,
        );
      } catch (error) {
        console.error(
          "Delete promotion failed:",
          error,
        );

        setErrorMessage(
          "RoadLink could not delete this promotion.",
        );
      } finally {
        setDeletingId(null);
      }
    },
    [createAuditLog],
  );

  const enrichedPromotions = useMemo(() => {
    return promotions.map((promotion) => {
      const usages = usageRecords.filter(
        (usage) =>
          usage.promotionId === promotion.id ||
          normalizeCode(usage.promotionCode) ===
            normalizeCode(promotion.code),
      );

      const usageCount = Math.max(
        safeNumber(promotion.usageCount),
        usages.length,
      );

      const discountCost = usages.reduce(
        (total, usage) =>
          total + safeNumber(usage.discountAmount),
        0,
      );

      const recoveredRevenue = usages.reduce(
        (total, usage) =>
          total + safeNumber(usage.finalAmount),
        0,
      );

      const originalRevenue = usages.reduce(
        (total, usage) =>
          total + safeNumber(usage.originalAmount),
        0,
      );

      const conversionRate =
        promotion.totalUsageLimit > 0
          ? clamp(
              (usageCount /
                promotion.totalUsageLimit) *
                100,
            )
          : 0;

      return {
        ...promotion,
        status: resolvePromotionStatus(promotion),
        usageCount,
        discountCost:
          discountCost ||
          safeNumber(promotion.discountCost),
        recoveredRevenue:
          recoveredRevenue ||
          safeNumber(promotion.recoveredRevenue),
        estimatedRevenue:
          originalRevenue ||
          safeNumber(promotion.estimatedRevenue),
        conversionRate:
          conversionRate ||
          safeNumber(promotion.conversionRate),
      };
    });
  }, [promotions, usageRecords]);

  const filteredPromotions = useMemo(() => {
    const search = normalizeString(searchTerm);

    return enrichedPromotions.filter(
      (promotion) => {
        const matchesSearch =
          !search ||
          normalizeString(
            `${promotion.name} ${promotion.code} ${promotion.description} ${promotion.routeFrom} ${promotion.routeTo}`,
          ).includes(search);

        const matchesStatus =
          statusFilter === "all" ||
          promotion.status === statusFilter;

        return matchesSearch && matchesStatus;
      },
    );
  }, [
    enrichedPromotions,
    searchTerm,
    statusFilter,
  ]);

  const metrics = useMemo(() => {
    const active = enrichedPromotions.filter(
      (promotion) =>
        promotion.status === "active",
    ).length;

    const scheduled = enrichedPromotions.filter(
      (promotion) =>
        promotion.status === "scheduled",
    ).length;

    const totalUses = enrichedPromotions.reduce(
      (total, promotion) =>
        total + promotion.usageCount,
      0,
    );

    const discountCost = enrichedPromotions.reduce(
      (total, promotion) =>
        total + promotion.discountCost,
      0,
    );

    const recoveredRevenue =
      enrichedPromotions.reduce(
        (total, promotion) =>
          total + promotion.recoveredRevenue,
        0,
      );

    const completedBookings = bookings.filter(
      (booking) =>
        ["completed", "confirmed"].includes(
          normalizeStatus(booking.status),
        ),
    ).length;

    const promotionBookings = bookings.filter(
      (booking) =>
        Boolean(
          booking.promotionCode ||
            booking.couponCode,
        ),
    ).length;

    const adoptionRate =
      completedBookings > 0
        ? (promotionBookings /
            completedBookings) *
          100
        : 0;

    return {
      active,
      scheduled,
      totalUses,
      discountCost,
      recoveredRevenue,
      adoptionRate,
    };
  }, [bookings, enrichedPromotions]);

  const topPromotions = useMemo(
    () =>
      [...enrichedPromotions]
        .sort(
          (first, second) =>
            second.usageCount -
            first.usageCount,
        )
        .slice(0, 6),
    [enrichedPromotions],
  );

  const previewDiscount =
    calculateDiscountPreview(
      form,
      previewAmount,
    );

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-12%] top-[-14%] h-[34rem] w-[34rem] rounded-full bg-emerald-500/10 blur-[150px]" />
        <div className="absolute right-[-10%] top-[12%] h-[32rem] w-[32rem] rounded-full bg-violet-500/[0.08] blur-[160px]" />
        <div className="absolute bottom-[-24%] left-[35%] h-[38rem] w-[38rem] rounded-full bg-cyan-500/[0.07] blur-[180px]" />
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
                Promotions
              </span>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10">
                <TicketPercent className="h-7 w-7 text-emerald-300" />
              </div>

              <div>
                <h1 className="text-2xl font-black sm:text-4xl">
                  Dynamic Promotions Center
                </h1>

                <p className="mt-1 max-w-3xl text-sm text-slate-400 sm:text-base">
                  Create, manage and analyze coupons,
                  discounts and automated RoadLink
                  campaigns.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={openCreateForm}
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-slate-950 shadow-xl shadow-emerald-500/20 transition hover:bg-emerald-400"
          >
            <Plus className="h-5 w-5" />
            Create promotion
          </button>
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

            <div className="min-w-0 flex-1">
              <p className="font-black">
                {errorMessage
                  ? "Promotion alert"
                  : "Promotion center updated"}
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
              className="text-current opacity-60 transition hover:opacity-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            title="Recovered Revenue"
            value={formatCurrency(
              metrics.recoveredRevenue,
            )}
            subtitle="Revenue generated after discounts"
            icon={
              <CircleDollarSign className="h-6 w-6" />
            }
            tone="green"
          />

          <MetricCard
            title="Active Promotions"
            value={metrics.active}
            subtitle={`${metrics.scheduled} scheduled campaigns`}
            icon={<Megaphone className="h-6 w-6" />}
            tone="purple"
          />

          <MetricCard
            title="Total Redemptions"
            value={metrics.totalUses}
            subtitle="Promotion usage records"
            icon={<Gift className="h-6 w-6" />}
            tone="cyan"
          />

          <MetricCard
            title="Discount Cost"
            value={formatCurrency(
              metrics.discountCost,
            )}
            subtitle="Total customer savings"
            icon={
              <BadgePercent className="h-6 w-6" />
            }
            tone="amber"
          />

          <MetricCard
            title="Adoption Rate"
            value={`${metrics.adoptionRate.toFixed(
              1,
            )}%`}
            subtitle="Bookings using a promotion"
            icon={<TrendingUp className="h-6 w-6" />}
            tone="green"
          />
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.42fr]">
          <article className="overflow-hidden rounded-[2rem] border border-white/[0.07] bg-slate-950/60 shadow-2xl shadow-black/25 backdrop-blur-2xl">
            <div className="border-b border-white/[0.06] p-5 sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-xl font-black">
                    <Tag className="h-5 w-5 text-emerald-300" />
                    Promotion campaigns
                  </h2>

                  <p className="mt-2 text-sm text-slate-500">
                    Manage campaign availability,
                    eligibility and performance.
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
                      setSearchTerm(
                        event.target.value,
                      )
                    }
                    placeholder="Search name, code or route..."
                    className="h-12 w-full rounded-2xl border border-white/[0.08] bg-slate-900/70 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400/40"
                  />
                </label>

                <label className="relative">
                  <select
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(
                        event.target
                          .value as PromotionFilter,
                      )
                    }
                    className="h-12 min-w-44 appearance-none rounded-2xl border border-white/[0.08] bg-slate-900/70 px-4 pr-10 text-sm font-black text-slate-300 outline-none"
                  >
                    <option value="all">
                      All status
                    </option>
                    <option value="active">
                      Active
                    </option>
                    <option value="scheduled">
                      Scheduled
                    </option>
                    <option value="expired">
                      Expired
                    </option>
                    <option value="disabled">
                      Disabled
                    </option>
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
                    Loading promotions...
                  </p>
                </div>
              ) : filteredPromotions.length === 0 ? (
                <div className="flex min-h-96 flex-col items-center justify-center px-6 text-center">
                  <TicketPercent className="h-12 w-12 text-emerald-300" />

                  <p className="mt-4 text-lg font-black">
                    No promotions found
                  </p>

                  <p className="mt-2 max-w-md text-sm text-slate-500">
                    Create a RoadLink promotion or
                    adjust the current filters.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.05]">
                  {filteredPromotions.map(
                    (promotion) => {
                      const usageProgress =
                        promotion.totalUsageLimit > 0
                          ? clamp(
                              (promotion.usageCount /
                                promotion.totalUsageLimit) *
                                100,
                            )
                          : 0;

                      return (
                        <button
                          key={promotion.id}
                          type="button"
                          onClick={() =>
                            setSelectedPromotion(
                              promotion,
                            )
                          }
                          className="group w-full p-5 text-left transition hover:bg-white/[0.025] sm:p-6"
                        >
                          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
                                    STATUS_STYLES[
                                      promotion.status
                                    ]
                                  }`}
                                >
                                  {
                                    STATUS_LABELS[
                                      promotion.status
                                    ]
                                  }
                                </span>

                                <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-violet-300">
                                  {
                                    AUDIENCE_LABELS[
                                      promotion.audience
                                    ]
                                  }
                                </span>

                                {promotion.automatic && (
                                  <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-300">
                                    Automatic
                                  </span>
                                )}
                              </div>

                              <div className="mt-3 flex items-center gap-3">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-500/15 bg-emerald-500/10">
                                  <TicketPercent className="h-5 w-5 text-emerald-300" />
                                </div>

                                <div className="min-w-0">
                                  <h3 className="truncate text-base font-black group-hover:text-emerald-300 sm:text-lg">
                                    {promotion.name}
                                  </h3>

                                  <div className="mt-1 flex flex-wrap items-center gap-2">
                                    <span className="font-mono text-xs font-black text-emerald-300">
                                      {promotion.code}
                                    </span>

                                    <span className="text-xs text-slate-600">
                                      •
                                    </span>

                                    <span className="text-xs text-slate-500">
                                      {promotion.discountType ===
                                      "percentage"
                                        ? `${promotion.discountValue}% off`
                                        : `${formatCurrency(
                                            promotion.discountValue,
                                          )} off`}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-400">
                                {promotion.description ||
                                  "No campaign description."}
                              </p>

                              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                                <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
                                  <p className="text-[10px] font-black uppercase text-slate-600">
                                    Uses
                                  </p>

                                  <p className="mt-1 text-lg font-black">
                                    {
                                      promotion.usageCount
                                    }
                                  </p>
                                </div>

                                <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
                                  <p className="text-[10px] font-black uppercase text-slate-600">
                                    Limit
                                  </p>

                                  <p className="mt-1 text-lg font-black">
                                    {promotion.totalUsageLimit ||
                                      "∞"}
                                  </p>
                                </div>

                                <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
                                  <p className="text-[10px] font-black uppercase text-slate-600">
                                    Revenue
                                  </p>

                                  <p className="mt-1 text-lg font-black text-emerald-300">
                                    {formatCurrency(
                                      promotion.recoveredRevenue,
                                    )}
                                  </p>
                                </div>

                                <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
                                  <p className="text-[10px] font-black uppercase text-slate-600">
                                    Discount cost
                                  </p>

                                  <p className="mt-1 text-lg font-black text-amber-300">
                                    {formatCurrency(
                                      promotion.discountCost,
                                    )}
                                  </p>
                                </div>
                              </div>

                              {promotion.totalUsageLimit >
                                0 && (
                                <div className="mt-4">
                                  <div className="mb-2 flex items-center justify-between text-xs">
                                    <span className="font-bold text-slate-500">
                                      Usage progress
                                    </span>

                                    <span className="font-black text-slate-300">
                                      {usageProgress.toFixed(
                                        0,
                                      )}
                                      %
                                    </span>
                                  </div>

                                  <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
                                    <div
                                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-300"
                                      style={{
                                        width: `${usageProgress}%`,
                                      }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="flex shrink-0 flex-row items-center gap-2 xl:flex-col">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  togglePromotion(
                                    promotion,
                                  );
                                }}
                                disabled={
                                  updatingId ===
                                  promotion.id
                                }
                                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-xs font-black text-slate-300 disabled:opacity-50"
                              >
                                {updatingId ===
                                promotion.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : promotion.enabled ? (
                                  <ToggleRight className="h-5 w-5 text-emerald-300" />
                                ) : (
                                  <ToggleLeft className="h-5 w-5 text-slate-500" />
                                )}

                                {promotion.enabled
                                  ? "Enabled"
                                  : "Disabled"}
                              </button>

                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openEditForm(
                                    promotion,
                                  );
                                }}
                                className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-400 transition hover:text-white"
                                aria-label="Edit promotion"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </button>
                      );
                    },
                  )}
                </div>
              )}
            </div>
          </article>

          <aside className="space-y-6">
            <article className="rounded-[2rem] border border-white/[0.07] bg-slate-950/60 p-5 shadow-2xl shadow-black/25 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black">
                    Top promotions
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Ranked by redemptions
                  </p>
                </div>

                <TrendingUp className="h-6 w-6 text-violet-300" />
              </div>

              <div className="mt-5 space-y-3">
                {topPromotions.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/[0.08] p-6 text-center">
                    <Target className="mx-auto h-8 w-8 text-emerald-300" />

                    <p className="mt-3 text-sm font-black text-slate-300">
                      No campaign data
                    </p>
                  </div>
                ) : (
                  topPromotions.map(
                    (promotion, index) => (
                      <button
                        key={promotion.id}
                        type="button"
                        onClick={() =>
                          setSelectedPromotion(
                            promotion,
                          )
                        }
                        className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3 text-left"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-sm font-black">
                          {index + 1}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-black">
                            {promotion.code}
                          </p>

                          <p className="mt-1 truncate text-xs text-slate-500">
                            {promotion.name}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-sm font-black text-emerald-300">
                            {promotion.usageCount}
                          </p>

                          <p className="text-[10px] font-black uppercase text-slate-600">
                            Uses
                          </p>
                        </div>
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
                    Campaign intelligence
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Promotional strategy overview
                  </p>
                </div>

                <Sparkles className="h-6 w-6 text-emerald-300" />
              </div>

              <div className="mt-5 space-y-3">
                <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.06] p-4">
                  <p className="flex items-center gap-2 text-sm font-black text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" />
                    Revenue protection
                  </p>

                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    Minimum-purchase and maximum-discount
                    controls protect RoadLink margins.
                  </p>
                </div>

                <div className="rounded-2xl border border-violet-500/15 bg-violet-500/[0.06] p-4">
                  <p className="flex items-center gap-2 text-sm font-black text-violet-300">
                    <UsersRound className="h-4 w-4" />
                    Audience targeting
                  </p>

                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    Campaigns can target all users,
                    passengers, drivers or new customers.
                  </p>
                </div>

                <div className="rounded-2xl border border-cyan-500/15 bg-cyan-500/[0.06] p-4">
                  <p className="flex items-center gap-2 text-sm font-black text-cyan-300">
                    <Route className="h-4 w-4" />
                    Route campaigns
                  </p>

                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    Restrict promotions to a specific
                    origin and destination when needed.
                  </p>
                </div>
              </div>
            </article>
          </aside>
        </section>
      </div>

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-md sm:items-center sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-label="Promotion editor"
        >
          <button
            type="button"
            onClick={() => setShowForm(false)}
            className="absolute inset-0"
            aria-label="Close promotion editor"
          />

          <div className="relative z-10 max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-t-[2rem] border border-white/[0.08] bg-[#030712] shadow-2xl shadow-black sm:rounded-[2rem]">
            <div className="sticky top-0 z-20 flex items-center justify-between border-b border-white/[0.06] bg-[#030712]/95 p-5 backdrop-blur-xl sm:p-6">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-300">
                  Promotion Builder
                </p>

                <h2 className="mt-2 text-xl font-black sm:text-2xl">
                  {form.id
                    ? "Edit promotion"
                    : "Create promotion"}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-slate-400"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[1fr_0.42fr]">
              <div className="space-y-6">
                <section className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-5">
                  <h3 className="flex items-center gap-2 font-black">
                    <Megaphone className="h-5 w-5 text-emerald-300" />
                    Campaign details
                  </h3>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <FormField label="Promotion name">
                      <input
                        type="text"
                        value={form.name}
                        onChange={(event) =>
                          updateForm(
                            "name",
                            event.target.value,
                          )
                        }
                        placeholder="Summer travel campaign"
                        className="h-12 w-full rounded-xl border border-white/[0.08] bg-slate-900/70 px-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400/40"
                      />
                    </FormField>

                    <FormField label="Promotion code">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={form.code}
                          onChange={(event) =>
                            updateForm(
                              "code",
                              normalizeCode(
                                event.target.value,
                              ),
                            )
                          }
                          placeholder="ROAD20"
                          className="h-12 min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-slate-900/70 px-4 font-mono text-sm font-black text-emerald-300 outline-none placeholder:text-slate-600 focus:border-emerald-400/40"
                        />

                        <button
                          type="button"
                          onClick={() =>
                            updateForm(
                              "code",
                              generateCode(),
                            )
                          }
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-400"
                          aria-label="Generate promotion code"
                        >
                          <Zap className="h-4 w-4" />
                        </button>
                      </div>
                    </FormField>
                  </div>

                  <div className="mt-4">
                    <FormField label="Description">
                      <textarea
                        value={form.description}
                        onChange={(event) =>
                          updateForm(
                            "description",
                            event.target.value,
                          )
                        }
                        rows={4}
                        placeholder="Describe the purpose and conditions of this promotion."
                        className="w-full resize-none rounded-xl border border-white/[0.08] bg-slate-900/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400/40"
                      />
                    </FormField>
                  </div>
                </section>

                <section className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-5">
                  <h3 className="flex items-center gap-2 font-black">
                    <BadgePercent className="h-5 w-5 text-violet-300" />
                    Discount configuration
                  </h3>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <FormField label="Discount type">
                      <select
                        value={form.discountType}
                        onChange={(event) =>
                          updateForm(
                            "discountType",
                            event.target
                              .value as DiscountType,
                          )
                        }
                        className="h-12 w-full rounded-xl border border-white/[0.08] bg-slate-900/70 px-4 text-sm font-black text-slate-300 outline-none"
                      >
                        <option value="percentage">
                          Percentage
                        </option>
                        <option value="fixed">
                          Fixed amount
                        </option>
                      </select>
                    </FormField>

                    <FormField
                      label={
                        form.discountType ===
                        "percentage"
                          ? "Discount percentage"
                          : "Discount amount"
                      }
                    >
                      <input
                        type="number"
                        min="0"
                        max={
                          form.discountType ===
                          "percentage"
                            ? 100
                            : undefined
                        }
                        step="0.01"
                        value={form.discountValue}
                        onChange={(event) =>
                          updateForm(
                            "discountValue",
                            safeNumber(
                              event.target.value,
                            ),
                          )
                        }
                        className="h-12 w-full rounded-xl border border-white/[0.08] bg-slate-900/70 px-4 text-sm text-white outline-none focus:border-emerald-400/40"
                      />
                    </FormField>

                    <FormField label="Minimum purchase">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.minimumPurchase}
                        onChange={(event) =>
                          updateForm(
                            "minimumPurchase",
                            safeNumber(
                              event.target.value,
                            ),
                          )
                        }
                        className="h-12 w-full rounded-xl border border-white/[0.08] bg-slate-900/70 px-4 text-sm text-white outline-none focus:border-emerald-400/40"
                      />
                    </FormField>

                    <FormField
                      label="Maximum discount"
                      description={
                        form.discountType === "fixed"
                          ? "Fixed discounts use the discount amount as their maximum."
                          : "Set zero for no additional maximum."
                      }
                    >
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        disabled={
                          form.discountType ===
                          "fixed"
                        }
                        value={
                          form.discountType ===
                          "fixed"
                            ? form.discountValue
                            : form.maximumDiscount
                        }
                        onChange={(event) =>
                          updateForm(
                            "maximumDiscount",
                            safeNumber(
                              event.target.value,
                            ),
                          )
                        }
                        className="h-12 w-full rounded-xl border border-white/[0.08] bg-slate-900/70 px-4 text-sm text-white outline-none disabled:cursor-not-allowed disabled:opacity-50 focus:border-emerald-400/40"
                      />
                    </FormField>
                  </div>
                </section>

                <section className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-5">
                  <h3 className="flex items-center gap-2 font-black">
                    <CalendarDays className="h-5 w-5 text-cyan-300" />
                    Availability and limits
                  </h3>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <FormField label="Start date">
                      <input
                        type="datetime-local"
                        value={form.startDate}
                        onChange={(event) =>
                          updateForm(
                            "startDate",
                            event.target.value,
                          )
                        }
                        className="h-12 w-full rounded-xl border border-white/[0.08] bg-slate-900/70 px-4 text-sm text-white outline-none focus:border-emerald-400/40"
                      />
                    </FormField>

                    <FormField label="Expiration date">
                      <input
                        type="datetime-local"
                        value={form.endDate}
                        onChange={(event) =>
                          updateForm(
                            "endDate",
                            event.target.value,
                          )
                        }
                        className="h-12 w-full rounded-xl border border-white/[0.08] bg-slate-900/70 px-4 text-sm text-white outline-none focus:border-emerald-400/40"
                      />
                    </FormField>

                    <FormField
                      label="Total usage limit"
                      description="Set zero for unlimited total redemptions."
                    >
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={form.totalUsageLimit}
                        onChange={(event) =>
                          updateForm(
                            "totalUsageLimit",
                            safeNumber(
                              event.target.value,
                            ),
                          )
                        }
                        className="h-12 w-full rounded-xl border border-white/[0.08] bg-slate-900/70 px-4 text-sm text-white outline-none focus:border-emerald-400/40"
                      />
                    </FormField>

                    <FormField label="Usage limit per user">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={
                          form.usageLimitPerUser
                        }
                        onChange={(event) =>
                          updateForm(
                            "usageLimitPerUser",
                            safeNumber(
                              event.target.value,
                            ),
                          )
                        }
                        className="h-12 w-full rounded-xl border border-white/[0.08] bg-slate-900/70 px-4 text-sm text-white outline-none focus:border-emerald-400/40"
                      />
                    </FormField>
                  </div>
                </section>

                <section className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-5">
                  <h3 className="flex items-center gap-2 font-black">
                    <Target className="h-5 w-5 text-amber-300" />
                    Audience and route targeting
                  </h3>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <FormField label="Audience">
                      <select
                        value={form.audience}
                        onChange={(event) =>
                          updateForm(
                            "audience",
                            event.target
                              .value as PromotionAudience,
                          )
                        }
                        className="h-12 w-full rounded-xl border border-white/[0.08] bg-slate-900/70 px-4 text-sm font-black text-slate-300 outline-none"
                      >
                        <option value="all">
                          All users
                        </option>
                        <option value="new_users">
                          New users
                        </option>
                        <option value="passengers">
                          Passengers
                        </option>
                        <option value="drivers">
                          Drivers
                        </option>
                      </select>
                    </FormField>

                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() =>
                          updateForm(
                            "firstBookingOnly",
                            !form.firstBookingOnly,
                          )
                        }
                        className={`flex h-12 w-full items-center justify-between rounded-xl border px-4 text-sm font-black ${
                          form.firstBookingOnly
                            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                            : "border-white/[0.08] bg-slate-900/70 text-slate-400"
                        }`}
                      >
                        First booking only

                        {form.firstBookingOnly ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : (
                          <XCircle className="h-5 w-5" />
                        )}
                      </button>
                    </div>

                    <FormField label="Route origin">
                      <input
                        type="text"
                        value={form.routeFrom}
                        onChange={(event) =>
                          updateForm(
                            "routeFrom",
                            event.target.value,
                          )
                        }
                        placeholder="Optional origin"
                        className="h-12 w-full rounded-xl border border-white/[0.08] bg-slate-900/70 px-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400/40"
                      />
                    </FormField>

                    <FormField label="Route destination">
                      <input
                        type="text"
                        value={form.routeTo}
                        onChange={(event) =>
                          updateForm(
                            "routeTo",
                            event.target.value,
                          )
                        }
                        placeholder="Optional destination"
                        className="h-12 w-full rounded-xl border border-white/[0.08] bg-slate-900/70 px-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400/40"
                      />
                    </FormField>
                  </div>
                </section>
              </div>

              <aside className="space-y-5">
                <section className="rounded-3xl border border-emerald-500/15 bg-emerald-500/[0.06] p-5">
                  <h3 className="flex items-center gap-2 font-black text-emerald-200">
                    <Sparkles className="h-5 w-5" />
                    Promotion preview
                  </h3>

                  <div className="mt-5 rounded-3xl border border-dashed border-emerald-400/25 bg-[#020617]/70 p-5 text-center">
                    <TicketPercent className="mx-auto h-9 w-9 text-emerald-300" />

                    <p className="mt-3 text-lg font-black">
                      {form.name ||
                        "RoadLink Promotion"}
                    </p>

                    <p className="mt-2 font-mono text-sm font-black tracking-wider text-emerald-300">
                      {form.code || "PROMO"}
                    </p>

                    <p className="mt-4 text-3xl font-black text-white">
                      {form.discountType ===
                      "percentage"
                        ? `${form.discountValue}% OFF`
                        : `${formatCurrency(
                            form.discountValue,
                          )} OFF`}
                    </p>

                    <p className="mt-3 text-xs leading-5 text-slate-500">
                      Minimum purchase{" "}
                      {formatCurrency(
                        form.minimumPurchase,
                      )}
                    </p>
                  </div>

                  <div className="mt-5">
                    <FormField label="Preview booking amount">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={previewAmount}
                        onChange={(event) =>
                          setPreviewAmount(
                            safeNumber(
                              event.target.value,
                            ),
                          )
                        }
                        className="h-12 w-full rounded-xl border border-white/[0.08] bg-slate-900/70 px-4 text-sm text-white outline-none focus:border-emerald-400/40"
                      />
                    </FormField>
                  </div>

                  <div className="mt-4 space-y-3 rounded-2xl border border-white/[0.06] bg-black/20 p-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">
                        Original amount
                      </span>

                      <span className="font-black">
                        {formatCurrency(
                          previewAmount,
                        )}
                      </span>
                    </div>

                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">
                        Discount
                      </span>

                      <span className="font-black text-emerald-300">
                        -
                        {formatCurrency(
                          previewDiscount,
                        )}
                      </span>
                    </div>

                    <div className="flex justify-between border-t border-white/[0.06] pt-3">
                      <span className="font-black">
                        Final amount
                      </span>

                      <span className="text-xl font-black text-white">
                        {formatCurrency(
                          Math.max(
                            previewAmount -
                              previewDiscount,
                            0,
                          ),
                        )}
                      </span>
                    </div>
                  </div>
                </section>

                <section className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-5">
                  <h3 className="font-black">
                    Campaign controls
                  </h3>

                  <div className="mt-4 space-y-3">
                    <button
                      type="button"
                      onClick={() =>
                        updateForm(
                          "enabled",
                          !form.enabled,
                        )
                      }
                      className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left ${
                        form.enabled
                          ? "border-emerald-500/20 bg-emerald-500/10"
                          : "border-white/[0.06] bg-white/[0.025]"
                      }`}
                    >
                      <div>
                        <p className="text-sm font-black">
                          Promotion enabled
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Customers may redeem it
                        </p>
                      </div>

                      {form.enabled ? (
                        <ToggleRight className="h-7 w-7 text-emerald-300" />
                      ) : (
                        <ToggleLeft className="h-7 w-7 text-slate-500" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        updateForm(
                          "automatic",
                          !form.automatic,
                        )
                      }
                      className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left ${
                        form.automatic
                          ? "border-cyan-500/20 bg-cyan-500/10"
                          : "border-white/[0.06] bg-white/[0.025]"
                      }`}
                    >
                      <div>
                        <p className="text-sm font-black">
                          Automatic campaign
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Eligible users receive it
                          automatically
                        </p>
                      </div>

                      {form.automatic ? (
                        <ToggleRight className="h-7 w-7 text-cyan-300" />
                      ) : (
                        <ToggleLeft className="h-7 w-7 text-slate-500" />
                      )}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={savePromotion}
                    disabled={saving}
                    className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 text-sm font-black text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}

                    {form.id
                      ? "Save changes"
                      : "Create promotion"}
                  </button>
                </section>
              </aside>
            </div>
          </div>
        </div>
      )}

      {selectedPromotion && !showForm && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-md sm:items-center sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-label="Promotion details"
        >
          <button
            type="button"
            onClick={() =>
              setSelectedPromotion(null)
            }
            className="absolute inset-0"
            aria-label="Close promotion details"
          />

          <div className="relative z-10 max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-t-[2rem] border border-white/[0.08] bg-[#030712] shadow-2xl shadow-black sm:rounded-[2rem]">
            <div className="sticky top-0 z-20 flex items-center justify-between border-b border-white/[0.06] bg-[#030712]/95 p-5 sm:p-6">
              <div className="min-w-0">
                <div className="flex flex-wrap gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
                      STATUS_STYLES[
                        selectedPromotion.status
                      ]
                    }`}
                  >
                    {
                      STATUS_LABELS[
                        selectedPromotion.status
                      ]
                    }
                  </span>

                  <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-violet-300">
                    {
                      AUDIENCE_LABELS[
                        selectedPromotion.audience
                      ]
                    }
                  </span>
                </div>

                <h2 className="mt-3 truncate text-xl font-black sm:text-2xl">
                  {selectedPromotion.name}
                </h2>

                <p className="mt-1 font-mono text-sm font-black text-emerald-300">
                  {selectedPromotion.code}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedPromotion(null)
                }
                className="ml-4 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-slate-400"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 sm:p-7">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  title="Discount"
                  value={
                    selectedPromotion.discountType ===
                    "percentage"
                      ? `${selectedPromotion.discountValue}%`
                      : formatCurrency(
                          selectedPromotion.discountValue,
                        )
                  }
                  subtitle={
                    selectedPromotion.discountType ===
                    "percentage"
                      ? "Percentage discount"
                      : "Fixed discount"
                  }
                  icon={
                    <BadgePercent className="h-6 w-6" />
                  }
                  tone="purple"
                />

                <MetricCard
                  title="Redemptions"
                  value={
                    selectedPromotion.usageCount
                  }
                  subtitle={`Limit ${
                    selectedPromotion.totalUsageLimit ||
                    "unlimited"
                  }`}
                  icon={<Gift className="h-6 w-6" />}
                  tone="cyan"
                />

                <MetricCard
                  title="Revenue"
                  value={formatCurrency(
                    selectedPromotion.recoveredRevenue,
                  )}
                  subtitle="Recovered campaign revenue"
                  icon={
                    <CircleDollarSign className="h-6 w-6" />
                  }
                  tone="green"
                />

                <MetricCard
                  title="Discount Cost"
                  value={formatCurrency(
                    selectedPromotion.discountCost,
                  )}
                  subtitle="Customer savings"
                  icon={
                    <TicketPercent className="h-6 w-6" />
                  }
                  tone="amber"
                />
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.75fr]">
                <div className="space-y-5">
                  <section className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-5">
                    <h3 className="font-black">
                      Campaign description
                    </h3>

                    <p className="mt-4 text-sm leading-7 text-slate-300">
                      {selectedPromotion.description ||
                        "No campaign description."}
                    </p>
                  </section>

                  <section className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-5">
                    <h3 className="font-black">
                      Eligibility rules
                    </h3>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/[0.05] bg-slate-950/50 p-4">
                        <p className="text-xs font-black uppercase text-slate-600">
                          Minimum purchase
                        </p>

                        <p className="mt-2 text-lg font-black">
                          {formatCurrency(
                            selectedPromotion.minimumPurchase,
                          )}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-white/[0.05] bg-slate-950/50 p-4">
                        <p className="text-xs font-black uppercase text-slate-600">
                          Per-user limit
                        </p>

                        <p className="mt-2 text-lg font-black">
                          {
                            selectedPromotion.usageLimitPerUser
                          }
                        </p>
                      </div>

                      <div className="rounded-2xl border border-white/[0.05] bg-slate-950/50 p-4">
                        <p className="text-xs font-black uppercase text-slate-600">
                          First booking
                        </p>

                        <p className="mt-2 text-lg font-black">
                          {selectedPromotion.firstBookingOnly
                            ? "Required"
                            : "Not required"}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-white/[0.05] bg-slate-950/50 p-4">
                        <p className="text-xs font-black uppercase text-slate-600">
                          Delivery
                        </p>

                        <p className="mt-2 text-lg font-black">
                          {selectedPromotion.automatic
                            ? "Automatic"
                            : "Code entry"}
                        </p>
                      </div>
                    </div>
                  </section>
                </div>

                <div className="space-y-5">
                  <section className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-5">
                    <h3 className="font-black">
                      Campaign information
                    </h3>

                    <dl className="mt-4 space-y-4">
                      {[
                        [
                          "Audience",
                          AUDIENCE_LABELS[
                            selectedPromotion.audience
                          ],
                        ],
                        [
                          "Start date",
                          formatDate(
                            selectedPromotion.startDate,
                          ),
                        ],
                        [
                          "Expiration",
                          formatDate(
                            selectedPromotion.endDate,
                          ),
                        ],
                        [
                          "Route",
                          selectedPromotion.routeKey
                            ? `${selectedPromotion.routeFrom} → ${selectedPromotion.routeTo}`
                            : "All routes",
                        ],
                        [
                          "Created",
                          formatRelative(
                            selectedPromotion.createdAt,
                          ),
                        ],
                        [
                          "Updated",
                          formatRelative(
                            selectedPromotion.updatedAt,
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
                  </section>

                  <section className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-5">
                    <h3 className="font-black">
                      Promotion actions
                    </h3>

                    <div className="mt-5 grid gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          openEditForm(
                            selectedPromotion,
                          )
                        }
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 text-sm font-black text-slate-950"
                      >
                        <Pencil className="h-4 w-4" />
                        Edit promotion
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          togglePromotion(
                            selectedPromotion,
                          )
                        }
                        disabled={
                          updatingId ===
                          selectedPromotion.id
                        }
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 text-sm font-black text-cyan-200 disabled:opacity-50"
                      >
                        {selectedPromotion.enabled ? (
                          <ToggleLeft className="h-5 w-5" />
                        ) : (
                          <ToggleRight className="h-5 w-5" />
                        )}

                        {selectedPromotion.enabled
                          ? "Disable promotion"
                          : "Enable promotion"}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          duplicatePromotion(
                            selectedPromotion,
                          )
                        }
                        disabled={
                          updatingId ===
                          selectedPromotion.id
                        }
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-violet-500/20 bg-violet-500/10 px-4 text-sm font-black text-violet-200 disabled:opacity-50"
                      >
                        <Copy className="h-4 w-4" />
                        Duplicate promotion
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          removePromotion(
                            selectedPromotion,
                          )
                        }
                        disabled={
                          deletingId ===
                          selectedPromotion.id
                        }
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 text-sm font-black text-red-200 disabled:opacity-50"
                      >
                        {deletingId ===
                        selectedPromotion.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}

                        Delete promotion
                      </button>
                    </div>
                  </section>

                  <section className="rounded-3xl border border-emerald-500/15 bg-emerald-500/[0.06] p-5">
                    <p className="flex items-center gap-2 text-sm font-black text-emerald-300">
                      <Clock3 className="h-4 w-4" />
                      Real-time campaign monitoring
                    </p>

                    <p className="mt-2 text-xs leading-5 text-slate-400">
                      Usage, revenue and discount costs
                      update from Firestore promotion
                      redemption records.
                    </p>
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
