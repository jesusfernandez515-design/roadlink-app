import { v2Request, v2AccountPath, v2Ready } from "../../../../lib/server/connect-v2";
import { apiFailure, ApiError } from "../../../../lib/server/firebase-admin";
import { connectDriver } from "../../../../lib/server/connect";
export async function GET(request: Request) {
  try {
    const { user, db, stripe } = await connectDriver(request);
    const record = (await db.collection("connectAccounts").doc(user.uid).get()).data();
    if (!record?.accountId) return Response.json({ connected: false, ready: false }, { headers: { "Cache-Control": "no-store" } });
    const account = await v2Request("GET", v2AccountPath(record.accountId));
    if (account.metadata.roadlinkUserId !== user.uid) throw new ApiError(409, "La cuenta requiere revisión.");
    return Response.json({ connected: true, ready: v2Ready(account), detailsSubmitted: v2Ready(account), payoutsEnabled: v2Ready(account), requirements: [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiFailure(error); }
}
