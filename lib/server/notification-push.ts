import { pushPresentation } from "../push-notification";
import type { Firestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { serverFirebase } from "./firebase-admin";
import { pushKey } from "./instant-push";

export type PushAlert = { id: string; mode: "driver" | "passenger" };
// Called inside a transaction; delivery only happens after the commit succeeds.
export function notificationRef(db: Firestore, alerts: PushAlert[], mode: PushAlert["mode"], id?: string) {
  const ref = db.collection("notifications").doc(id);
  alerts.push({ id: ref.id, mode });
  return ref;
}
export async function deliverNotificationPush(alerts: PushAlert[]) {
  if (!pushKey()) return;
  const unique = new Map(alerts.map(alert => [alert.id, alert]));
  for (const { id, mode } of unique.values()) {
    try {
      const { db, app } = serverFirebase();
      const ref = db.collection("notifications").doc(id);
      const alert = await db.runTransaction(async tx => {
        const value = (await tx.get(ref)).data();
        if (!value?.userId || value.read || value.closed || value.pushStatus === "sent" ||
            (value.pushStatus === "sending" && Date.parse(value.pushLeaseUntil) > Date.now())) return null;
        tx.update(ref, { pushStatus: "sending", pushLeaseUntil: new Date(Date.now() + 60000).toISOString() });
        return value;
      });
      if (!alert) continue;
      const rows = await db.collection("pushDevices").where("userId", "==", alert.userId).where("enabled", "==", true).limit(11).get();
      if (!rows.size || rows.size > 10) { await ref.set({ pushStatus: rows.size ? "failed" : "no_devices" }, { merge: true }); continue; }
      const prefix = mode === "driver" ? "/conductor" : "/pasajero";
      const screen = alert.type === "message" ? "/messages" : alert.type === "instant_offer" ? "/ride-now" : mode === "driver" ? "/my-rides" : "/my-bookings";
      // Lock-screen text never includes message contents, guest contacts, routes or payment details.
      const presentation = pushPresentation(mode, alert.type);
      const response = await getMessaging(app).sendEachForMulticast({
        tokens: rows.docs.map(row => row.data().token),
        notification: { title: presentation.title, body: presentation.body },
        data: { kind: String(alert.type || "booking") },
        webpush: { headers: { TTL: "3600", Urgency: "high" }, notification: { tag: `roadlink-${id}`, icon: presentation.icon },
          fcmOptions: { link: `https://www.getroadlink.com${prefix}${screen}` } },
      });
      await Promise.all(response.responses.map(async (result, i) => {
        if (!result.success && ["messaging/registration-token-not-registered", "messaging/invalid-registration-token"].includes(result.error?.code || "")) await rows.docs[i].ref.set({ enabled: false }, { merge: true });
      }));
      await ref.set({ pushStatus: response.failureCount ? "failed" : "sent", pushAccepted: response.successCount, pushFailed: response.failureCount, pushAttemptedAt: new Date().toISOString() }, { merge: true });
    } catch { console.error("RoadLink notification push unavailable"); }
  }
}
