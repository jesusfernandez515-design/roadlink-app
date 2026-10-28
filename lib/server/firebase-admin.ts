import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function serverFirebase() {
  const environment = process.env.NEXT_PUBLIC_ROADLINK_ENV || "production";
  if (!["test", "production"].includes(environment)) throw new ApiError(503, "El entorno del servidor no es válido.");
  const test = environment === "test";
  const projectId = test ? "roadlink-pruebas" : "roadlink-7646d";
  const name = `roadlink-server-${projectId}`;
  let app = getApps().find((item) => item.name === name);
  if (!app) {
    const raw = test ? process.env.FIREBASE_TEST_SERVICE_ACCOUNT_JSON : process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) throw new ApiError(503, "El acceso al servidor no está configurado.");
    const account = JSON.parse(raw);
    if (account.project_id !== projectId) throw new ApiError(503, "La configuración del servidor no corresponde a este entorno.");
    app = initializeApp({ credential: cert(account), projectId }, name);
  }
  return { auth: getAuth(app), db: getFirestore(app, test ? "default" : "(default)") };
}

export async function requirePassenger(request: Request) {
  const bearer = request.headers.get("authorization")?.match(/^Bearer (\S+)$/)?.[1];
  if (!bearer) throw new ApiError(401, "Inicia sesión para continuar.");
  const { auth, db } = serverFirebase();
  let user;
  try { user = await auth.verifyIdToken(bearer, true); }
  catch { throw new ApiError(401, "Tu sesión no es válida o ha caducado. Vuelve a iniciar sesión."); }
  if (!user.email_verified) throw new ApiError(403, "Verifica tu correo para continuar.");
  if (process.env.NEXT_PUBLIC_ROADLINK_ENV === "test" &&
      !["XmpCtSTIS6cf7r8UMc2UxLFj6qH3", "DefaRi3pT2c5ZKs5gwc66lywFWN2"].includes(user.uid)) {
    throw new ApiError(403, "Este entorno de pruebas es privado.");
  }
  return { user, db };
}

export function apiFailure(error: unknown) {
  if (error instanceof ApiError) return Response.json({ error: error.message }, { status: error.status });
  console.error("RoadLink server operation failed", error instanceof Error ? error.name : "unknown");
  return Response.json({ error: "No se pudo completar la operación. Inténtalo más tarde." }, { status: 500 });
}

export function documentId(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    throw new ApiError(400, "La referencia no es válida.");
  }
  return value;
}
