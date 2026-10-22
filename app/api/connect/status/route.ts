import { apiFailure, ApiError } from "../../../../lib/server/firebase-admin";
import { connectDriver } from "../../../../lib/server/connect";
export async function GET(request: Request) {
  try {
    const { user, db, stripe } = await connectDriver(request);
    const record = (await db.collection("connectAccounts").doc(user.uid).get()).data();
    if (!record?.accountId) return Response.json({ connected: false, ready: false }, { headers: { "Cache-Control": "no-store" } });
    const account = await stripe.accounts.retrieve(record.accountId);
    if (account.metadata.roadlinkUserId !== user.uid) throw new ApiError(409, "La cuenta requiere revisión.");
    return Response.json({ connected: true, ready: account.capabilities?.transfers === "active" && account.payouts_enabled, detailsSubmitted: account.details_submitted, payoutsEnabled: account.payouts_enabled, requirements: account.requirements?.currently_due || [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiFailure(error); }
}
