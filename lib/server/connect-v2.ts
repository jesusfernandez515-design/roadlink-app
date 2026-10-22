import { ApiError } from "./firebase-admin";

// Isolated version pin: existing Checkout and webhook API versions stay unchanged.
export const CONNECT_VERSION = "2026-09-30.preview";
export async function v2Request(method: "GET" | "POST", path: string, body?: Record<string, unknown>, idempotencyKey?: string) {
  const key = process.env.STRIPE_TEST_SECRET_KEY;
  if (process.env.NEXT_PUBLIC_ROADLINK_ENV !== "test" || !key?.startsWith("sk_test_")) throw new ApiError(503, "Accounts v2 solo está configurado para pruebas.");
  if (!/^\/v2\/core\/(accounts(?:\/acct_[A-Za-z0-9]+)?(?:\?.*)?|account_links)$/.test(path)) throw new ApiError(400, "Invalid Connect endpoint.");
  const response = await fetch(`https://api.stripe.com${path}`, { method, headers: { Authorization: `Bearer ${key}`, "Stripe-Version": CONNECT_VERSION, "Content-Type": "application/json", ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000), cache: "no-store" });
  const data = await response.json();
  if (!response.ok) {
    const error = Object.assign(new Error(String(data.error?.message || "Stripe rechazó la solicitud de Accounts v2.")), { type: "StripeInvalidRequestError", code: data.error?.code, param: data.error?.param, requestId: response.headers.get("request-id") });
    throw error;
  }
  if (data.livemode !== false) throw new ApiError(409, "Stripe devolvió una respuesta fuera del entorno de pruebas.");
  return data;
}
export function v2AccountPath(id: string) {
  if (!/^acct_[A-Za-z0-9]+$/.test(id)) throw new ApiError(409, "Invalid Stripe account.");
  return `/v2/core/accounts/${id}?include[0]=configuration.recipient&include[1]=requirements`;
}
export function v2Ready(account: { configuration?: { recipient?: { capabilities?: { stripe_balance?: { stripe_transfers?: { status?: string }; payouts?: { status?: string } } } } } }) {
  const balance = account.configuration?.recipient?.capabilities?.stripe_balance;
  return balance?.stripe_transfers?.status === "active" && balance?.payouts?.status === "active";
}
