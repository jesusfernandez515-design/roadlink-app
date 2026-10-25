import { ApiError, requirePassenger } from "./firebase-admin";
import { paymentConfig } from "./payments";

export async function connectDriver(request: Request) {
  if (process.env.NEXT_PUBLIC_ROADLINK_ENV !== "test") throw new ApiError(404, "Not found.");
  const context = await requirePassenger(request);
  if (context.user.uid !== "XmpCtSTIS6cf7r8UMc2UxLFj6qH3") throw new ApiError(403, "Solo el conductor del piloto puede usar Connect.");
  const config = paymentConfig();
  if (!config.test) throw new ApiError(503, "Connect solo está habilitado en pruebas.");
  return { ...context, stripe: config.stripe };
}
