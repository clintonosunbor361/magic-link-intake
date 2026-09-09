# Release verification

Updated September 9, 2026. Changes remain under release verification; this document does not certify a production deployment.

## Implemented and reviewed

- Notifications persist delivery attempts, atomically claim queued messages, retain immutable payloads, and use provider idempotency keys. One overdue message is sent per deadline; failed deliveries retry within bounded safety rules. Recipient routing follows the agreed specification. The authenticated cron supports a read-only dry run.
- Vendor ratings require eligible completed work and preserve legacy ratings and score revisions.
- Rescheduling fittings invalidates old confirmation requests while retaining previous decisions as history.
- Client approval and confirmation validation preserves the submitted decision, preventing a correction request from accidentally becoming a confirmation after validation fails.
- Order tabs use shared workspace components. Assistant access to approval batches is retained, and financial permissions follow the agreed specification.
- Local release scripts guard against hosted database URLs and avoid database resets.

## Evidence

- September 9: 645 unit tests across 75 files passed.
- September 9: seven database policy assertions and five database integration tests passed. TypeScript and the production build passed.
- Browser coverage includes intake, staff permissions, responsive screens, approvals, vendor brief blockers, and Client-to-Order financial completion. September 9: all eight browser tests passed, including the payment-gated completion journey.
- The explicitly authorized notification test to emmanuelezenwigbo@gmail.com was reported delivered by Resend (message `c5069f64-b217-4d17-ab88-90839977562f`). This proves provider delivery for the test, not production cron execution.

## Remaining release checks

- Apply pending migrations 0034 and 0035 to the verified deployment database and deploy the reviewed application.
- Verify the deployed cron authentication and read-only dry run, and observe a scheduled run.
- Review production service configuration and remaining manual checklist items before marking all issue acceptance criteria complete.

See [notification operations](notifications.md) for delivery semantics, configuration, and retry limitations.
