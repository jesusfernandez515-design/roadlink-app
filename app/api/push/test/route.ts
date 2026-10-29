import { ApiError, apiFailure, requirePassenger } from "../../../../lib/server/firebase-admin";
import { pushKey } from "../../../../lib/server/instant-push";
import { deliverNotificationPush } from "../../../../lib/server/notification-push";

export async function POST(request: Request) {
  try {
    const { user, db } = await requirePassenger(request);
    if (!pushKey()) throw new ApiError(503, "Las notificaciones push no están configuradas.");
    const { appExperience } = await request.json();
    if (!["driver", "passenger"].includes(appExperience)) throw new ApiError(400, "Selecciona una app válida.");
    // One self-addressed test per app and minute; no arbitrary recipients or payloads.
    const id = `push_test_${user.uid}_${appExperience}_${Math.floor(Date.now() / 60000)}`;
    const ref = db.collection("notifications").doc(id);
    await db.runTransaction(async tx => {
      if ((await tx.get(ref)).exists) return;
      tx.set(ref, { userId: user.uid, type: "push_test", title: "Prueba de notificaciones", message: "Prueba de notificaciones push de RoadLink.", read: false, createdAt: new Date().toISOString() });
    });
    await deliverNotificationPush([{ id, mode: appExperience }]);
    const alert = (await ref.get()).data();
    return Response.json({ accepted: Number(alert?.pushAccepted || 0), status: alert?.pushStatus || "unavailable" }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiFailure(error); }
}
