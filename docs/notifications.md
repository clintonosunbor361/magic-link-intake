# Notification operation and verification

Updated September 8, 2026. Product decisions are in PRODUCT_ARCHITECTURE_SPEC.md section 13.

## Delivery

Dashboard reminders cover open Client to-dos, production assignments, dated Look accessories,
and scheduled fittings. Windows are 7, 3, and 1 days before a deadline plus one overdue alert.
Whole-Order accessories have no inferred deadline. Dates use the organization's timezone.

To-dos and accessories email their assignee. Unassigned accessories fall back to the Order owner;
production and fitting reminders email the Order owner. Only active organization members qualify.
Both staff roles share the organization's notification inbox and read state.

Vercel invokes `/api/cron/notifications` daily at 06:00 UTC (07:00 Lagos). Hobby scheduling can
arrive during that hour; it is not an exact-minute appointment reminder. The endpoint requires
`Authorization: Bearer <CRON_SECRET>` and rejects missing or incorrect secrets before database work.

## Configuration

| Variable | Purpose | Owner |
| --- | --- | --- |
| DATABASE_URL | Privileged server-side Postgres connection | Project administrator |
| NEXT_PUBLIC_APP_URL | Canonical HTTPS production URL for email links | Project administrator |
| RESEND_API_KEY | Sending key for the verified Resend domain | Email administrator |
| RESEND_FROM_EMAIL | Sender on that verified domain | Email administrator |
| CRON_SECRET | Random secret shared by Vercel Cron and the route | Project administrator |

Keep secrets out of commits and logs. Production configuration changes take effect on the next
deployment. The production CRON_SECRET was added to the linked Vercel project during this review.
Migrations 0034 and 0035 have been applied to the deployment database, as confirmed September 9, 2026.
Migration 0036 adds Consultation Note templates and structured details without deleting existing data.
The custom-migration workflow is required because older custom migrations left stale
schema snapshots; a generic `db:generate` currently attempts to recreate retired Enquiries tables.
Do not accept that generated diff or run database resets against hosted data.

## Failure handling

An eligible email is queued on the persisted dashboard notification. Claims use an organization-scoped,
compare-and-set lease. Acknowledged successful sends are never selected again. Retries use the same
Resend idempotency key and saved payload. A changed recipient, revoked membership, completed work,
or moved deadline stops an old queued email.

The cron drains batches within its time budget and retries transient failures twice in the same run.
Definitively rejected sends can retry in subsequent daily runs, up to five attempts in total.
Pending eligible work survives the original trigger day; catch-up dashboard-only history is not emailed.

Resend retains idempotency keys for 24 hours. An uncertain outcome (for example, a network timeout
after provider acceptance) retries only inside a conservative 23-hour window. After that it needs
review instead of risking duplicate delivery. A later rejection does not erase earlier uncertainty.
The Notifications page distinguishes retry-pending failures from email needing review. “Sent” means
provider acceptance; it does not assert that a person read the message.

## Verification

```bash
npm test -- tests/notifications tests/auth/cron.test.ts
npm run test:db:local
npm run test:integration:local
npm run test:e2e:local
npm run typecheck
npm run build
```

Database integration tests use random fixture IDs inside rolled-back transactions. Browser tests use
local Supabase, dedicated test organizations and private local file fixtures. Real Resend delivery is
disabled in browser tests. Release scripts do not reset databases or accept hosted test endpoints.

After deployment, call the protected endpoint with `?dryRun=1` using the production secret through a
secure client. It checks the real source queries, retry queue schema and email configuration without
creating notifications or sending messages. Confirm an unauthenticated request returns 401.
Then observe the next scheduled invocation in Vercel logs and the Notifications inbox.

A real, explicitly authorized test through `sendDeadlineEmail` was accepted and reported **delivered**
by Resend to the user's specified Gmail address. Message ID: `c5069f64-b217-4d17-ab88-90839977562f`.
This verifies provider delivery; deployment and scheduled invocation are separate release checks.

Sources: [Vercel cron management](https://vercel.com/docs/cron-jobs/manage-cron-jobs),
[Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).
