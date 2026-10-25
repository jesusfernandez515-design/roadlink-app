import { ApiError, apiFailure } from "../../../../lib/server/firebase-admin";
import { connectDriver } from "../../../../lib/server/connect";
export async function GET(request: Request) {
  try {
    const { user, db } = await connectDriver(request);
    const sources = [["bookings", "driverId"], ["walletTransactions", "driverId"], ["payoutRequests", "userId"]];
    const snapshots = await Promise.all(sources.map(([name, field]) => db.collection(name).where(field, "==", user.uid).limit(201).get()));
    if (snapshots.some((snapshot) => snapshot.size > 200)) throw new ApiError(409, "El historial requiere paginación antes de calcular el saldo.");
    const rows = snapshots.map((snapshot) => snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id })));
    return Response.json({ bookings: rows[0], walletTransactions: rows[1], payouts: rows[2] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiFailure(error); }
}
