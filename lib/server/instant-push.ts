import { pushPresentation } from "../push-notification";
import { createHash } from "node:crypto";
import { getMessaging } from "firebase-admin/messaging";
import { ApiError, serverFirebase } from "./firebase-admin";

export function pushKey() {
  const key = process.env.NEXT_PUBLIC_FIREBASE_TEST_VAPID_KEY || "";
  return process.env.NEXT_PUBLIC_ROADLINK_ENV === "test" && /^B[A-Za-z0-9_-]{86}$/.test(key) ? key : "";
}
export function pushDeviceId(token: unknown) {
  if (typeof token !== "string" || !/^[A-Za-z0-9_:.-]{20,4096}$/.test(token)) throw new ApiError(400, "El dispositivo no es válido. Intenta activarlo de nuevo.");
  return createHash("sha256").update(token).digest("hex");
}
const invalidTokenCodes = new Set(["messaging/registration-token-not-registered", "messaging/invalid-registration-token"]);

// Never throw after a request is committed. In-app notifications remain the durable source.
export async function deliverInstantPush(requestId: string, version: string, driverIds: string[]) {
  if (!pushKey()) return;
  try {
    const { db, app } = serverFirebase();
    for (const driverId of driverIds) {
      const notificationRef = db.collection("notifications").doc(`instant_${version}_${driverId}`);
      const requestRef = db.collection("instantRequests").doc(requestId);
      const leased = await db.runTransaction(async tx => {
        const [alert, request] = await Promise.all([tx.get(notificationRef), tx.get(requestRef)]);
        const a = alert.data(), r = request.data(), now = Date.now();
        if (!a || a.userId !== driverId || a.closed || a.read || a.pushStatus === "sent" ||
          (a.pushStatus === "sending" && Date.parse(a.pushLeaseUntil) > now) ||
          !r || r.version !== version || r.status !== "open" || Date.parse(r.expiresAt) <= now || r.declinedBy?.[driverId]) return null;
        tx.update(notificationRef, { pushStatus: "sending", pushLeaseUntil: new Date(now + 60000).toISOString() });
        return r.expiresAt as string;
      });
      if (!leased) continue;
      try {
        const rows = await db.collection("pushDevices").where("userId", "==", driverId).where("enabled", "==", true).limit(11).get();
        const devices = rows.docs.filter(row => row.data().enabled === true);
        if (!devices.length || rows.size > 10) {
          await notificationRef.set({ pushStatus: devices.length ? "failed" : "no_devices" }, { merge: true });
          continue;
        }
        const ttl = Math.max(0, Math.min(900, Math.floor((Date.parse(leased) - Date.now()) / 1000)));
        if (!ttl) { await notificationRef.set({ pushStatus: "expired" }, { merge: true }); continue; }
        const presentation = pushPresentation("driver", "instant_request");
        const response = await getMessaging(app).sendEachForMulticast({
          tokens: devices.map(row => row.data().token),
          notification: { title: presentation.title, body: presentation.body },
          data: { kind: "instant_request" },
          webpush: { headers: { TTL: String(ttl), Urgency: "high" },
            notification: { tag: `roadlink-instant-${version}`, icon: presentation.icon },
            fcmOptions: { link: "https://www.getroadlink.com/conductor/ride-now" } },
        });
        await Promise.all(response.responses.map(async (result, i) => {
          if (!result.success && invalidTokenCodes.has(result.error?.code || "")) await devices[i].ref.set({ enabled: false }, { merge: true });
        }));
        await notificationRef.set({ pushStatus: response.failureCount ? "failed" : "sent", pushAccepted: response.successCount, pushFailed: response.failureCount,
          pushAttemptedAt: new Date().toISOString() }, { merge: true });
      } catch {
        await notificationRef.set({ pushStatus: "failed", pushAttemptedAt: new Date().toISOString() }, { merge: true });
      }
    }
  } catch { console.error("RoadLink push delivery unavailable"); }
}
