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

## Preparación de alertas push (pendiente de activación y prueba en dispositivo)

La integración usa el SDK Firebase 11.10.0 ya instalado, Firebase Admin y un service worker exclusivo de `/conductor/`. No añade caché de páginas ni cambia las identidades de las dos PWAs. Solicita permiso solo al pulsar el botón del dispositivo.

Requisito pendiente: configurar en el proyecto Firebase **roadlink-pruebas** las credenciales Web Push, verificar FCM HTTP v1 y añadir en Vercel `NEXT_PUBLIC_FIREBASE_TEST_VAPID_KEY` con la **clave pública** VAPID del mismo proyecto. No copiar claves privadas ni credenciales del servidor al cliente. Después se necesita un nuevo despliegue y una prueba desde un teléfono con permiso concedido. La conexión oficial de Firebase aparece disponible pero sin conectar; la sesión de consola anterior ya no está autenticada.

Mientras falte la clave pública, el botón queda deshabilitado y explica que la configuración está pendiente. Una clave con formato válido o un token guardado no demuestran recepción; la interfaz lo aclara. Cada teléfono/navegador debe registrarse con la cuenta del conductor.

`/api/push/subscription` verifica sesión, correo, piloto y directorio de conductores en el servidor. Los identificadores de dispositivos son hashes SHA-256 del token; `pushDevices` sigue cubierto por la denegación por defecto de las reglas. Solo el servidor lo lee/escribe. Limita a diez dispositivos activos por cuenta. El token nunca aparece en URLs, registros ni mensajes de interfaz. Los cambios de cuenta y cierre de sesión invalidan la suscripción local; los tokens rechazados por FCM se desactivan en el servidor.

Al crear una solicitud se intenta enviar una notificación genérica a los dispositivos registrados de sus conductores destinatarios. Se comprueban versión, caducidad, estado y rechazo antes del intento, y se usa una concesión temporal para evitar envíos concurrentes repetidos. No se envían nombres de invitados, teléfonos, instrucciones ni direcciones al aviso del sistema. El enlace siempre apunta a la sección de solicitudes de Conductor, donde se vuelve a verificar el estado. El aviso puede llegar tarde por restricciones del sistema operativo; su TTL no supera la vigencia de la solicitud.

Las notificaciones de Firestore son la fuente duradera, incluso si FCM falla. `pushStatus: sent` significa que FCM aceptó el envío, no que el teléfono lo mostró. Se conservan los fallos para diagnóstico; **no hay un trabajo periódico de reintento configurado**. No se verificó todavía una entrega push real ni el flujo completo entre dispositivos. Pagos reales desactivados.

Referencias: https://firebase.google.com/docs/cloud-messaging/web/get-started y https://firebase.google.com/docs/cloud-messaging/web/receive-messages (consultadas 2026-10-28; se mantiene la API de tokens compatible con la versión instalada, sin actualizar todo el SDK).
