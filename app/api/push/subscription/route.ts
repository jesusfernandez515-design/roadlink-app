import { ApiError, apiFailure, requirePassenger } from "../../../../lib/server/firebase-admin";
import { instantDrivers } from "../../../../lib/server/instant-drivers";
import { pushDeviceId, pushKey } from "../../../../lib/server/instant-push";

const headers = { "Cache-Control": "private, no-store" };
async function session(request: Request) {
  if (process.env.NEXT_PUBLIC_ROADLINK_ENV !== "test") throw new ApiError(503, "Las alertas push están disponibles solo en el piloto.");
  const context = await requirePassenger(request);
  const driver = (await instantDrivers(context.db)).includes(context.user.uid);
  return { ...context, driver };
}
export async function GET(request: Request) {
  try { const { driver } = await session(request); return Response.json({ driver, configured: Boolean(pushKey()), vapidKey: driver ? pushKey() : "" }, { headers }); }
  catch (error) { return apiFailure(error); }
}
export async function POST(request: Request) {
  try {
    const { user, db, driver } = await session(request);
    const body = await request.json(), id = pushDeviceId(body.token);
    const ref = db.collection("pushDevices").doc(id);
    if (!["enable", "disable"].includes(body.action)) throw new ApiError(400, "Acción no válida.");
    if (body.action === "enable" && (!driver || !pushKey())) throw new ApiError(403, "Las alertas push todavía no están disponibles para esta cuenta.");
    await db.runTransaction(async tx => {
      const current = (await tx.get(ref)).data();
      if (body.action === "disable") {
        if (current?.userId === user.uid) tx.update(ref, { enabled: false, updatedAt: new Date().toISOString() });
        return;
      }
      const devices = await tx.get(db.collection("pushDevices").where("userId", "==", user.uid).where("enabled", "==", true).limit(11));
      if (!(current?.userId === user.uid && current.enabled) && devices.size >= 10) throw new ApiError(409, "Ya tienes diez dispositivos registrados. Desactiva uno antes de añadir otro.");
      // Token owner is derived from the verified session, never from the request body.
      tx.set(ref, { userId: user.uid, token: body.token, enabled: true, updatedAt: new Date().toISOString() });
    });
    return Response.json({ enabled: body.action === "enable" }, { headers });
  } catch (error) { return apiFailure(error); }
}
