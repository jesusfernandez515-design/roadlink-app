# Private pilot security and payment setup

The rules in `firestore.test.rules` are ONLY for `roadlink-pruebas`, named database `default`. They allow the two existing verified test accounts; passenger/conductor data stays private. Money, reservations, seat availability and Stripe events are server-only. Roles cannot be granted from a profile. Driver profile sharing, chat writes and driver approval/completion need dedicated server endpoints before a full pilot. Do not deploy these two-account rules to production.

Preview branch `fix/pilot-security` needs server-only Secret variables:

- `FIREBASE_TEST_SERVICE_ACCOUNT_JSON`: service account JSON for roadlink-pruebas, limited to Firebase Authentication token validation and Firestore data access. Never use a NEXT_PUBLIC prefix. Do not commit/download keys into the repo. Prefer workload federation when provisioning long-term access.
- `STRIPE_TEST_SECRET_KEY`: Stripe sandbox sk_test_ key. There is deliberately no fallback to the shared production key.
- `STRIPE_TEST_WEBHOOK_SECRET`: sandbox endpoint signature secret. Register `/api/stripe/webhook` on the stable branch hostname for checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.expired and charge.refunded.

Production uses separate FIREBASE_SERVICE_ACCOUNT_JSON, STRIPE_SECRET_KEY (sk_live_) and STRIPE_WEBHOOK_SECRET; this change does not configure or deploy production rules.

Payments return 503 until configured. Client-supplied user IDs/emails/prices/redirects are ignored. ID tokens are verified against the configured project, including revocation and verified email. Stripe sessions use idempotency keys. Booking status is locked before checkout so cancellation cannot race a payment. Open sessions are reused. Expired sessions unlock unpaid bookings. Webhooks validate signature, environment, booking owner, reservation version, amount/currency and deduplicate events atomically. Browser redirects never mark a payment paid.

Paid/pending checkouts require review before cancellation. No refund initiation endpoint is exposed. Verified charge.refunded webhooks reconcile full/partial refunds and reduce pending driver earnings; actual bank payouts are not implemented here. Refunds do not automatically cancel the ride or restore seats.

## Validation

- `npx tsc --noEmit`
- `npm run build`
- `npx firebase-tools@13 emulators:exec --project demo-roadlink-security --only firestore 'node --test tests/firestore-rules.cjs'`
- `node --test tests/server-security.cjs`

Once secrets are securely configured and preview redeployed: sign in as passenger, reserve, open sandbox checkout, use Stripe's test card, confirm signed webhook updates payment/booking/wallet once, replay event, then issue sandbox partial and full refunds and confirm no duplicate wallet credit. Test expired checkout then cancellation. Do not run real-money transactions.

## Rollout gate

The existing demo branch is preserved. Do not replace the current test rules until the server credential is configured on fix/pilot-security and reservation/cancellation are re-tested there. The staged rules intentionally disable client writes used by the old demo. Publish to roadlink-pruebas/default only as part of the coordinated pilot switch.

Validation on 2026-10-21: 9 server policy/route tests pass using an in-memory Firestore adapter and real Stripe webhook signatures; 3 Firestore Emulator rule suites pass. These are automated tests, not live Stripe sandbox charge/refund verification. The emulator tests use database (default) to test the same database-agnostic rules; rollout targets the named database default.
