# RoadLink production candidate

Status: blocked for real payments. Do not enable the live flag or promote until the remaining items are verified.

## Verified

- Candidate includes the Firestore write type fix (`WithFieldValue<RefundRequest>`) for the disputes build failure on main.
- Sandbox payment, completion, transfer, full refund and single transfer reversal were verified with Stripe.
- Sandbox webhook remains enabled on the protected pilot branch. It is not a production webhook.
- Server payment configuration now rejects production by default. It requires explicit ROADLINK_LIVE_PAYMENTS_ENABLED=true plus server Firebase credentials and a live webhook signing secret.

## Required configuration

Production environment metadata currently lists STRIPE_SECRET_KEY, but its account and live activation have not been verified. Do not export keys or put them in this document.

Missing production variables: FIREBASE_SERVICE_ACCOUNT_JSON (project roadlink-7646d) and STRIPE_WEBHOOK_SECRET (for the production endpoint).

The connected Stripe integration exposes only sandbox acct_1TlLBoCmDRfm6qaa. Access to the owner's real Stripe platform must be established separately. Verify account identity, activation and Connect responsibilities before creating real connected accounts.

## Remaining implementation

Connect onboarding, transfer, wallet server access and full-refund recovery are intentionally restricted to the private test driver and sandbox. They must be adapted and reviewed before live use. Merely enabling the live flag does not make Connect production-ready.

Replace test account allowlists and sandbox account checks with verified production driver eligibility and platform account checks. Keep server-derived amounts, ownership validation, idempotency and refund reconciliation. Add explicit live-mode tests. Handle partial transfer reversals and insufficient connected balances operationally.

Configure a production signed webhook at https://getroadlink.com/api/stripe/webhook after deploying reviewed code. Verify payment/refund delivery, account requirements updates and payout/dispute reconciliation. Keep production data and connected accounts separate from the sandbox.

## Release sequence

1. Review candidate code and complete live Connect implementation.
2. Provision production-only credentials and verify real platform account.
3. Verify driver onboarding, operational refund rules, reconciliation and monitoring.
4. Review full production build and change set against main.
5. Obtain final launch approval, deploy, enable the live payment gate and run a controlled real transaction.

No live charges or production deployment were authorized by this preparation.
