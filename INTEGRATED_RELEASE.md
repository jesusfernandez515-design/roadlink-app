# Integrated RoadLink sandbox release

Includes the luxury Spanish homepage and every fix from pilot commit 104acaf8157df13819ae0edede5bec8141e60073. No pilot functionality was reverted to the older public release.

## Configuration for getroadlink.com

This is a public URL for the existing PRIVATE two-account sandbox, not public registration or live commerce. NEXT_PUBLIC_ROADLINK_ENV=test selects roadlink-pruebas / named database default. Keep the existing two-account server and Firestore restrictions. The global notice clearly identifies fictitious payments. paymentConfig refuses every non-test deployment, even if a live Stripe key is configured.

Promotion requires separately approved Vercel configuration: the existing sandbox server credential, sandbox Stripe secret and webhook signing secret must be available to the Production target, together with NEXT_PUBLIC_ROADLINK_ENV=test. No credentials belong in this repository. Do not replace production Firestore rules or copy production data.

The existing signed Stripe sandbox webhook stays on the stable fix/pilot-security hostname; both deployments must use the same isolated test database. Verify signatures and duplicate delivery handling. Keep that branch and hostname maintained with the integrated webhook handler.

## Verification

Run node --test tests/server-security.cjs tests/wallet-totals.cjs and a test-mode Next production build. These exercise reserve → checkout → signed webhook → confirmation → completion → transfer → full refund → recovery with in-memory Firestore and mocked Stripe API responses; webhook signatures use the real Stripe SDK. They do not constitute a new authenticated browser payment or bank payout.

Historical live sandbox charge/transfer/refund verification exists in the pilot. A fresh two-account browser verification remains required after changing the public hostname. Test email/password sign-in and authorize the exact domain in Firebase before offering Google sign-in. No real-money transaction is authorized or enabled.
