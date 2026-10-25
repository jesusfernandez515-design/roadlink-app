import { apiFailure, ApiError, documentId, requirePassenger } from "../../../lib/server/firebase-admin";

// Only the public identity fields are exposed, never the private user document.
export async function GET(request: Request) {
  try {
    const { user, db } = await requirePassenger(request);
    const uid = documentId(new URL(request.url).searchParams.get("uid"));
    if (uid !== user.uid) {
      const [rides, outgoing, incoming] = await Promise.all([
        db.collection("rides").where("driverId", "==", uid).where("status", "==", "active").limit(1).get(),
        db.collection("bookings").where("driverId", "==", user.uid).where("passengerId", "==", uid).limit(1).get(),
        db.collection("bookings").where("passengerId", "==", user.uid).where("driverId", "==", uid).limit(1).get(),
      ]);
      if (rides.size === 0 && outgoing.size === 0 && incoming.size === 0) throw new ApiError(403, "Este perfil no está disponible para tu cuenta.");
    }
    const profile = (await db.collection("users").doc(uid).get()).data();
    const photo = typeof profile?.photoURL === "string" ? profile.photoURL : "";
    const photoURL = /^(https:\/\/|data:image\/(jpeg|png|webp);base64,)/i.test(photo) && photo.length < 400000 ? photo : "";
    return Response.json({ name: typeof profile?.name === "string" ? profile.name.slice(0, 120) : "", photoURL }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiFailure(error); }
}
