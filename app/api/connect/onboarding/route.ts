import { v2Request, v2AccountPath } from "../../../../lib/server/connect-v2";
import { apiFailure, ApiError } from "../../../../lib/server/firebase-admin";
import { connectDriver } from "../../../../lib/server/connect";
export async function POST(request: Request) {
  let stage = "comprobar la conexión";
  try {
    const { user, db, stripe } = await connectDriver(request);
    const platform = await stripe.accounts.retrieve();
    if (platform.id !== "acct_1TlLBoCmDRfm6qaa") {
      throw new ApiError(409, `La clave de RoadLink pertenece a otra cuenta de pruebas (${platform.id}). Connect se activó en acct_1TlLBoCmDRfm6qaa. Hay que corregir la configuración del servidor.`);
    }
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
      stage = "crear la cuenta del conductor";
      const account = await v2Request("POST", "/v2/core/accounts", {
        contact_email: user.email, display_name: "Conductor de pruebas de RoadLink",
        identity: { country: "us", entity_type: "individual" }, dashboard: "express",
        defaults: { responsibilities: { fees_collector: "application", losses_collector: "application" } },
        configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true }, payouts: { requested: true } } } } },
        metadata: { roadlinkUserId: user.uid, environment: "test" },
        include: ["configuration.recipient", "requirements"],
      }, `connect-v2-${user.uid}-${record.startedAt}`);
      accountId = account.id;
      await ref.set({ accountId, userId: user.uid, environment: "test" }, { merge: true });
    }
    stage = "consultar la cuenta del conductor";
    const account = await v2Request("GET", v2AccountPath(accountId));
    if (account.metadata.roadlinkUserId !== user.uid) throw new ApiError(409, "La cuenta requiere revisión.");
    if (mode === "dashboard") {
      const link = await stripe.accounts.createLoginLink(accountId);
      return Response.json({ url: link.url });
    }
    const origin = new URL(request.url).origin;
    stage = "abrir el registro del conductor";
    const link = await v2Request("POST", "/v2/core/account_links", { account: accountId, use_case: { type: "account_onboarding", account_onboarding: { configurations: ["recipient"], refresh_url: `${origin}/wallet?connect=refresh`, return_url: `${origin}/wallet?connect=return` } } });
    return Response.json({ url: link.url });
  } catch (error) {
    if ((error as { type?: string })?.type === "StripeInvalidRequestError") {
      const failure = error as { message?: string; code?: string; param?: string; requestId?: string };
      const clean = (value?: string) => String(value || "")
        .replace(/(?:sk|rk|pk)_(?:test|live)_[A-Za-z0-9_]+/g, "[clave oculta]")
        .replace(/https?:\/\/[^\s]+/g, "[enlace de Stripe]")
        .slice(0, 350);
      const reference = /^req_[A-Za-z0-9]+$/.test(failure.requestId || "") ? failure.requestId : "";
      return Response.json({ error: `Stripe rechazó ${stage}: ${clean(failure.message) || "Solicitud no válida."}${failure.code ? ` Código: ${clean(failure.code)}.` : ""}${failure.param ? ` Campo: ${clean(failure.param)}.` : ""}${reference ? ` Referencia: ${reference}.` : ""}` }, { status: 409 });
    }
    return apiFailure(error);
  }
}
