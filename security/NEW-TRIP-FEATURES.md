# Immediate requests, guests and two-step sign-in

This release remains a PRIVATE two-account sandbox. Real Stripe charges remain blocked by lib/server/payments.ts. No Firestore rules or account permissions were expanded.

## Immediate requests

Both apps expose /ride-now (also /pasajero/ride-now and /conductor/ride-now). The authenticated passenger requests a pickup; the authorized pilot driver proposes a total test price, vehicle, pickup time and duration. The passenger must accept that exact unexpired offer before a server transaction creates a full one-seat ride and unpaid booking.

Requests expire after 15 minutes; offers expire after 5 minutes. No availability, actual arrival or live GPS is guaranteed. Pickup and duration are estimates entered by the driver. instantRequests and instantDriverLocks are server-only under the existing deny-by-default rules. Only the assigned pilot driver can offer; guest contact details are omitted from unassigned request listings.

Acceptance uses the request version, a unique offer ID, and offer expiration as a quote version. Transactional driver locks prevent overlapping assignments. The ordinary booking/ride cancellation and completion handlers release the lock for the matching ride only. Pending payments still require reconciliation before cancellation. Booking status and wallet amounts cannot be set by the caller.

## Guest reservations

Both scheduled search and ride details use the authenticated reservation endpoint. Choose “Otra persona / invitado”, enter their name, phone and pickup instructions, and confirm permission to share with the driver. The payer remains the signed-in account (passengerId). All payment, cancellation and chat ownership follows that account. A guest does not receive account access, an SMS, a tracking link or an invitation automatically.

Guest details are attached to the private booking and displayed to its account owner and assigned driver. The same form is available for immediate requests. New self-reservations replace any prior guest data after cancellation.

## Two-step authentication

/security offers opt-in Firebase TOTP enrollment with recent reauthentication and verified email. The secret remains in component memory; it is not saved to Firestore, browser storage, logs or a remote QR service. Configuration requires confirming a valid TOTP. Login catches MFA-required errors for both password and Google sign-in and resolves the second factor before routing to the account.

Prerequisite: Firebase Authentication with Identity Platform and the TOTP provider enabled in roadlink-pruebas. Do not report MFA as active for an account until Firebase enrollment succeeds. This code does not automatically upgrade the project, enroll users, disable factors, change quotas, add billing, or create recovery codes.

For a project administrator: scripts/enable-totp-mfa.cjs can enable TOTP after Identity Platform is available. Run it only with the existing FIREBASE_TEST_SERVICE_ACCOUNT_JSON injected securely and appropriate Firebase Auth configuration permission. It rejects production project credentials, preserves existing provider configuration, and verifies the result without printing credentials.

Lost authenticators require the an administrator-assisted support process that verifies identity before changing factors. Password reset must not bypass or remove MFA. No self-service factor-removal endpoint was added.

## Validation

51 automated checks pass, covering existing payment/auth rules plus guest ownership/consent and contact validation, request/quote expiry, stale quote rejection, idempotent acceptance, driver locks, cancellation release and TOTP resolution. Next test-mode production build passes.

These checks mock Firebase/Stripe; they do not replace the next authenticated two-account browser rehearsal or actual authenticator enrollment. No real-money transaction is authorized.

## Solicitudes de último minuto (28 de octubre de 2026)

- Buscar viajes permite enviar la solicitud desde la misma pantalla y conserva los datos del invitado en memoria; no los pone en URLs ni almacenamiento local.
- Al crear la solicitud, la misma transacción guarda una notificación privada por cada conductor autorizado. El directorio `instantDrivers/{uid}` (`enabled: true`) es solo del servidor; no se modifica desde el perfil. La lista sigue limitada a las dos cuentas autorizadas del piloto. El conductor piloto existente permanece habilitado. No se incorporaron cuentas ni se cambiaron reglas o permisos.
- Todos los destinatarios ven una alerta en la aplicación Conductor mientras esté abierta y una entrada en Notificaciones → Viajes de último minuto. No hay entrega push con la app cerrada, SMS ni correo; requieren configurar un canal de entrega independiente.
- Cada conductor puede enviar su propia propuesta o rechazar. Rechazar solo oculta esa versión para ese conductor, elimina su propuesta y cierra su alerta; la solicitud continúa para los demás.
- El pasajero puede comparar propuestas. Su aceptación explícita del precio crea una sola reserva y bloquea al conductor en una transacción Firestore. Repetir la misma aceptación devuelve la reserva existente; intentar elegir otra propuesta después devuelve un conflicto, sin una segunda asignación.
- Aceptar o cancelar cierra las alertas de solicitud. Las alertas caducadas se ocultan. Los datos de contacto del invitado siguen reservados para la cuenta propietaria y el conductor asignado.
- Pruebas automatizadas con base en memoria: dos propuestas independientes, aceptación competitiva serializada, un solo viaje/reserva/bloqueo, rechazo individual, invalidación de propuestas rechazadas y cierre de alertas. Estas pruebas no sustituyen una prueba con varios dispositivos y Firestore real.
- Pagos reales desactivados: no se modificó `lib/server/payments.ts` ni la configuración Stripe.
