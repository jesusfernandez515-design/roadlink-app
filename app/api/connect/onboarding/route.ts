import { apiFailure, ApiError } from "../../../../lib/server/firebase-admin";
import { connectDriver } from "../../../../lib/server/connect";
export async function POST(request: Request) {
  try {
    const { user, db, stripe } = await connectDriver(request);
    const { mode } = await request.json();
    const ref = db.collection("connectAccounts").doc(user.uid);
    const record = await db.runTransaction(async (tx) => {
      const old = (await tx.get(ref)).data();
      if (old?.accountId) return old;
      if (mode === "dashboard") throw new ApiError(409, "Conecta primero tu cuenta.");
      const startedAt = old?.startedAt || Date.now();
      if (Date.now() - startedAt > 20 * 3600000) throw new ApiError(409, "El registro requiere revisión antes de reintentarlo.");
      tx.set(ref, { startedAt, userId: user.uid, environment: "test" }, { merge: true });
      return { startedAt, accountId: "" };
    });
    let accountId = record.accountId;
    if (!accountId) {
      const account = await stripe.accounts.create({ country: "US", email: user.email, capabilities: { transfers: { requested: true } }, controller: { fees: { payer: "application" }, losses: { payments: "application" }, requirement_collection: "stripe", stripe_dashboard: { type: "express" } }, metadata: { roadlinkUserId: user.uid, environment: "test" } }, { idempotencyKey: `connect-test-${user.uid}-${record.startedAt}` });
      accountId = account.id;
      await ref.set({ accountId, userId: user.uid, environment: "test" }, { merge: true });
    }
    const account = await stripe.accounts.retrieve(accountId);
    if (account.metadata.roadlinkUserId !== user.uid) throw new ApiError(409, "La cuenta requiere revisión.");
    if (mode === "dashboard") {
      const link = await stripe.accounts.createLoginLink(accountId);
      return Response.json({ url: link.url });
    }
    const origin = new URL(request.url).origin;
    const link = await stripe.accountLinks.create({ account: accountId, type: "account_onboarding", refresh_url: `${origin}/wallet?connect=refresh`, return_url: `${origin}/wallet?connect=return` });
    return Response.json({ url: link.url });
  } catch (error) {
    if ((error as { type?: string })?.type === "StripeInvalidRequestError") return Response.json({ error: "Stripe no permite completar Connect todavía. Revisa la configuración de Connect del entorno de pruebas en Stripe." }, { status: 409 });
    return apiFailure(error);
  }
}
