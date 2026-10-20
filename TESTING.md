# Isolated Firebase testing

The default Firebase target remains roadlink-7646d (production).
Set NEXT_PUBLIC_ROADLINK_ENV=test before building to select roadlink-pruebas.
Only production and test are accepted. The supplied Firebase web configuration is public client configuration, not an administrative credential.

Local test build:

```sh
NEXT_PUBLIC_ROADLINK_ENV=test npm run build
npm run start -- --hostname 127.0.0.1
```

For Vercel, set NEXT_PUBLIC_ROADLINK_ENV=test for a branch-specific Preview deployment of fix/demo-readiness and rebuild. Do not set it in Production. Keep real Stripe keys out of the test preview. The variable is embedded at build time, so changing it requires a rebuild.

Before two-account tests:
1. Enable Authentication > Email/Password in roadlink-pruebas.
2. Create the default Cloud Firestore database in roadlink-pruebas and configure rules for the intended user, ride, booking and chat access. Do not copy production records or enable public writes.
3. Add the exact test preview hostname to Authentication authorized domains if required by the login flow.
4. Verify the compiled app targets roadlink-pruebas before creating accounts or rides.
5. Use separate browser sessions for a driver and passenger. Publish a clearly labeled future TEST ride; search, reserve, check seat counts, cancel and check restoration; exchange messages and verify unread counts.

No authenticated flow or payment is considered tested merely because the app compiles. Live Stripe checkout remains disabled without credentials and authentication/ownership enforcement requires a separate review.
