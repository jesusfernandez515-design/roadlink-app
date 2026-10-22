# RoadLink Connect test integration

Approved configuration: RoadLink collects passenger payments, retains 12%, and transfers driver net only after paid bookings are completed. Stripe Express dashboard, Stripe-hosted identity and bank onboarding; platform pays payment fees and owns connected-account negative balance liability. Stripe fees reduce RoadLink margin, not the agreed 88% driver net.

## Implemented scope
- Sandbox only, assigned pilot driver, verified Firebase ID token, isolated Firebase test database and Stripe test key. Production endpoints return 404.
- Separate charges and transfers, funded from the verified source charge. This is a transfer to the driver's Stripe balance, not confirmation of bank settlement.
- Server-only account mapping in connectAccounts. Account creation and each wallet transfer have persistent operation IDs and Stripe idempotency keys. Ambiguous operations remain blocked and can retry for up to 20 hours, then require reconciliation.
- Stripe account onboarding and Express login links generated only for the authenticated driver's stored account. No client account IDs, transfer amounts or bank credentials accepted.
- Eligibility requires completed booking, paid/nonrefunded test payment, exact driver net and active transfers capability plus payouts_enabled. Each wallet movement is reserved atomically before Stripe is called.
- Refunds before transfer continue ordinary wallet reconciliation. Refunds during/after transfer freeze the movement in transfer_review. They require operator reconciliation and, when appropriate, a Stripe transfer reversal; automatic reversal is not implemented.

## Remaining validation and production blockers
- Driver completes Stripe-hosted sandbox onboarding; platform may need Connect setup in its Stripe sandbox Dashboard. Confirm platform eligibility with Stripe.
- Exercise an actual sandbox transfer and inspect its Stripe record. Unit/mocked checks do not prove a bank payout.
- Bank deposits and their webhook status are not tracked by RoadLink. Driver consults Stripe dashboard. No account is labelled bank-paid based on a Connect transfer.
- Automated transfer reversal, payout reconciliation/events, broader driver onboarding/country support, dispute operations and production readiness remain outside this test implementation. Do not enable real payments or merge to production as-is.
- Account creation, retrieval and onboarding use Accounts v2 JSON requests pinned to 2026-09-30.preview. Recipient stripe_balance transfers and payouts must both be active. Existing Checkout/webhook API versions and SDK remain unchanged.

## Official references
- https://docs.stripe.com/connect/separate-charges-and-transfers
- https://docs.stripe.com/connect/integration-recommendations
- https://docs.stripe.com/connect/hosted-onboarding
- https://docs.stripe.com/connect/migrate-to-controller-properties
