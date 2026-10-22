import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function serverFirebase() {
  const environment = process.env.NEXT_PUBLIC_ROADLINK_ENV || "production";
  if (!["test", "production"].includes(environment)) throw new ApiError(503, "Invalid server environment.");
  const test = environment === "test";
  const projectId = test ? "roadlink-pruebas" : "roadlink-7646d";
  const name = `roadlink-server-${projectId}`;
  let app = getApps().find((item) => item.name === name);
  if (!app) {
    const raw = test ? process.env.FIREBASE_TEST_SERVICE_ACCOUNT_JSON : process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) throw new ApiError(503, "Firebase server access is not configured.");
    const account = JSON.parse(raw);
    if (account.project_id !== projectId) throw new ApiError(503, "Firebase server project mismatch.");
    app = initializeApp({ credential: cert(account), projectId }, name);
  }
  return { auth: getAuth(app), db: getFirestore(app, test ? "default" : "(default)") };
}

export async function requirePassenger(request: Request) {
  const bearer = request.headers.get("authorization")?.match(/^Bearer (\S+)$/)?.[1];
  if (!bearer) throw new ApiError(401, "Sign in before continuing.");
  const { auth, db } = serverFirebase();
  let user;
  try { user = await auth.verifyIdToken(bearer, true); }
  catch { throw new ApiError(401, "Your session is invalid or expired."); }
  if (!user.email_verified) throw new ApiError(403, "Verify your email before continuing.");
  if (process.env.NEXT_PUBLIC_ROADLINK_ENV === "test" &&
      !["XmpCtSTIS6cf7r8UMc2UxLFj6qH3", "DefaRi3pT2c5ZKs5gwc66lywFWN2"].includes(user.uid)) {
    throw new ApiError(403, "This test environment is private.");
  }
  return { user, db };
}

export function apiFailure(error: unknown) {
  if (error instanceof ApiError) return Response.json({ error: error.message }, { status: error.status });
  console.error("RoadLink server operation failed", error instanceof Error ? error.name : "unknown");
  return Response.json({ error: "The operation could not be completed. Try again later." }, { status: 500 });
}

export function documentId(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    throw new ApiError(400, "Invalid document identifier.");
  }
  return value;
}
