# Release verification

Updated September 10, 2026. Local release verification is complete for the current worktree. Migration 0036 and the verified revision are deployed in production.

## Implemented and reviewed

- Notifications persist delivery attempts, atomically claim queued messages, retain immutable payloads, and use provider idempotency keys. One overdue message is sent per deadline; failed deliveries retry within bounded safety rules. Recipient routing follows the agreed specification. The authenticated cron supports a read-only dry run.
- Vendor ratings require eligible completed work and preserve legacy ratings and score revisions.
- Rescheduling fittings invalidates old confirmation requests while retaining previous decisions as history.
- Client approval and confirmation validation preserves the submitted decision, preventing a correction request from accidentally becoming a confirmation after validation fails.
- Order tabs use shared workspace components. Assistant access to approval batches is retained, and financial permissions follow the agreed specification.
- Local release scripts guard against hosted database URLs and avoid database resets.
- Consultation Note sources now carry stable input templates. Structured Email, reference-link, and colour details are validated server-side, retained through revisions, and included in Vendor Briefs only when staff explicitly select the note.
- Invoice PDF authorization messages no longer claim the workflow is Super Admin-only, and outstanding Vendor Rating queries now belong to the rating repository.

## Evidence

- `EV-LOCAL-20260910`: 650 unit tests across 76 files passed.
- `EV-DB-20260910`: seven database policy assertions and five database integration tests passed. The isolated database applied migration 0036 successfully.
- `EV-BROWSER-20260910`: all eight Playwright journeys passed, including completion-expiry regression coverage, the payment-gated completion journey, and responsive mobile coverage.
- `EV-BUILD-20260910`: strict TypeScript and the production build passed.
- Browser coverage includes intake, staff permissions, responsive screens, approvals, vendor brief blockers, and Client-to-Order financial completion.
- `EV-RESEND-20260909`: the explicitly authorized notification test to emmanuelezenwigbo@gmail.com was reported delivered by Resend (message `c5069f64-b217-4d17-ab88-90839977562f`). This proves provider delivery for the test, not production cron execution.
- `EV-VERCEL-20260910`: deployment `dpl_ApaHU79CMvHTiGn7tYxhRR1cG6Rz` is Ready and aliased to `https://kuartz-crm.vercel.app`.
- `EV-CRON-20260909`: the deployed notification endpoint returned 401 without credentials and 200 for an authenticated dry run. It evaluated six sources and 20 planned reminders without writing or sending.
- `EV-CRON-SCHEDULED-20260910`: Vercel invoked `GET /api/cron/notifications` on deployment `dpl_DRMMDAmoJyH1ekn1apXqLaAZao4i` at 06:41 UTC and recorded HTTP 200. Two vendor-assignment notifications were persisted at that time, but their three Resend attempts ended in retry-safe `validation_error` failures. A read-only Resend account check found no registered sender domain.
- `EV-R2-20260909`: a labelled 292-byte optimized JPEG was uploaded to production R2. Anonymous access was denied, its two-second signed URL returned 200 before expiry and 403 afterward, and the temporary object was removed.
- `EV-CAPABILITY-20260910`: two labelled production Client/Order contexts proved correct-context access, cross-context isolation, exclusion of internal fields and uploads, tamper rejection, expiry, replacement invalidation, and completion invalidation. Operational test records were archived and no usable tokens were retained.
- `EV-PDF-20260910`: the first authenticated production probe exposed missing Chromium output tracing for both PDF routes. After changing the dynamic-route trace patterns and deploying the fix, the Admin Assistant release identity received non-empty `application/pdf` responses for Invoice and Vendor Brief exports with `Cache-Control: no-store`; anonymous access was rejected and send/export metadata persisted. Mutable fixtures were archived; labelled immutable Invoice and audit evidence remains.

## Remaining release checks

- Migrations 0034 and 0035 were completed as confirmed by the user; migration 0036 was applied successfully before the reviewed deployment.
- Complete production password recovery with the dedicated `emmanuelezenwigbo+kuartz-release@gmail.com` test identity.
- Register and verify the production sender domain in Resend, configure `RESEND_FROM_EMAIL` to use it, and observe a successful retry of the two scheduled reminder emails.

See [notification operations](notifications.md) for delivery semantics, configuration, and retry limitations.
