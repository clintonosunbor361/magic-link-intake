
  # Kuartz CRM: Complete and Verify the Build Checklist

  ## Completion contract

  Complete every applicable Phase 1 item in BUILD_AND_TEST_CHECKLIST.md: inspect existing behavior, fix confirmed gaps, verify results, and record
  evidence. Continue through production verification and deployment of necessary fixes.

  The checklist is a tracking document; PRODUCT_ARCHITECTURE_SPEC.md and the decisions below govern implementation. Preserve working intake,
  existing data, and the current visual design.

  Completion requires:

  - No applicable Phase 1 item remains unchecked or partial.
  - Every completed test item has evidence appropriate to its claim.
  - Deferred features are explicitly identified outside the active checklist.
  - All 17 files under .scratch/build-test-checklist-completion/issues have accurate acceptance criteria, status, and evidence.
  - Local checks pass and production verification is complete.

  ## 1. Reconcile requirements and establish evidence

  Before changing application code:

  1. Read repository instructions, the product spec, the entire checklist, release-verification documentation, notification operations, and all 17
     task files.

  2. Inventory every checklist entry, including existing checkmarks. Assign stable evidence identifiers and map each entry to its requirement,
     implementation, verification method, result, and remaining action.

  3. Inspect existing tests and run the current release suite to establish a baseline. Treat previously recorded results as historical evidence, not
     a fresh passing run.

  4. Correct stale descriptions of Order tabs, measurement editing, and the “Current Main Gap.”
  5. Replace obsolete open decisions with the confirmed release decisions. Move SMS, fitting-correction vendor sharing/export, alternative hosting,
     and additional deferred lifecycle behavior outside the active completion list.

  6. Record migrations 0034/0035 as user-confirmed completed. Verify the deployed migration ledger through read-only inspection when access is
     available; do not rerun them merely because documentation says pending.

  7. Retain the recorded successful Resend delivery as provider evidence. Track protected cron execution and scheduled invocation separately.

  Keep the evidence ledger in docs/release-verification.md. Record date, revision/deployment, environment, command or scenario, result, and relevant
  artifact references. Never record secrets or usable capability tokens.

  A passing aggregate suite does not automatically prove every checklist row. Identify the particular assertions or browser observations that
  support each claim.

  ## 2. Complete remaining application work

  Work through the existing task files in dependency order. For each task: inspect implementation → verify existing coverage → fix uncovered
  behavior → run focused checks → update acceptance evidence.

   Work group                          Existing tasks    Verification focus
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ━━━━━━━━━━━━━━━━  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Authentication and core workflow    01–05             Both roles, recovery, permissions, intake, duplicate warnings, Client lifecycle, Order
                                                         creation, Looks/Items, tabs, order confirmation
  ──────────────────────────────────  ────────────────  ────────────────────────────────────────────────────────────────────────────────────────────
   Style and measurements              06–07             Consultation inputs, uploads/revisions, approval decisions, measurement history,
                                                         requirements, scoped confirmations
  ──────────────────────────────────  ────────────────  ────────────────────────────────────────────────────────────────────────────────────────────
   Production and finance              08–10             Assignment, production filters/history, brief export, note selection, invoice/payment
                                                         permissions, balances, audited overrides
  ──────────────────────────────────  ────────────────  ────────────────────────────────────────────────────────────────────────────────────────────
   Supporting operations               11–14             Confirmed accessory/fitting/rating behavior, dashboard accuracy, notification timing and
                                                         delivery
  ──────────────────────────────────  ────────────────  ────────────────────────────────────────────────────────────────────────────────────────────
   Release completion                  15–17             Responsive/accessibility review, production services, complete evidence and checklist
                                                         reconciliation

  Verify existing Vendors, Production, and Measurements tabs before modifying them. Retain shared workspaces and detail pages where they satisfy the
  workflow.

  ### Agreed consultation-note behavior

  Implement small source templates for both create and edit forms:

   Source                                        Inputs beyond existing note text and optional occurrence date
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Email                                         Subject (optional)
  ────────────────────────────────────────────  ───────────────────────────────────────────────────────────────
   WhatsApp / Sketch reference                   Reference URL (optional)
  ────────────────────────────────────────────  ───────────────────────────────────────────────────────────────
   Colour reference                              Colour name (optional), colour code (optional)
  ────────────────────────────────────────────  ───────────────────────────────────────────────────────────────
   In-person / Phone / Other / custom sources    No additional inputs by default

  Implementation decisions:

  - Keep existing Body content intact and required.
  - Add a stable template value to source configuration; use a fixed template selector in existing source Settings, not a configurable field
    builder.

  - Persist structured details on notes and their historical revisions. Existing notes default to empty details.
  - Source renaming must not change its template. Unknown/custom sources default to the generic template.
  - Validate submitted details on the server. Reference URLs permit HTTP/HTTPS only and are never automatically fetched.
  - Source changes must not silently discard entered or previously saved details; retain them and allow explicit clearing.
  - Display saved details internally. Include them in vendor briefs only when staff explicitly select that consultation note; exclude them from
    client capability pages.

  - Document the agreed templates in the product spec.

  Generate additive migrations through Drizzle’s supported workflow. Inspect generated SQL for unrelated changes: existing documentation warns that
  stale snapshots may recreate retired Enquiries tables. Reject that output and use the supported custom-migration workflow when necessary; never
  hand-edit generated migrations.

  ### Cited code fixes

  - Correct the invoice PDF authorization error without narrowing either role’s legitimate invoice access. Verify both authorized roles and
    rejection cases.

  - Move rating-query ownership from the finance repository to the vendor-rating domain and update callers while preserving completion transactions
    and duplicate prevention.

  - Consolidate duplicated styling in the three shared workspace components using existing UI primitives or shared styles; preserve appearance and
    behavior.

  Fix additional demonstrated Phase 1 defects discovered during verification. Add focused regression coverage for isolated bugs. Do not introduce a
  broad redesign or deferred functionality.

  ## 3. Verify locally and in production

  ### Local verification

  Use focused service, component, database, and browser checks during each slice. Cover both permitted actions and rejection paths, especially
  organization isolation, capability scope, financial authority, required comments, archival behavior, and overrides.

  Exercise responsive workflows at mobile, tablet, and desktop widths. Verify keyboard access, labels, overflow, empty/error states, lightweight
  Order creation, and approved-revision visibility. Record browser evidence for subjective UX checklist entries.

  After the final application changes, run:

  npm run test:release

  This must pass unit tests, database/RLS assertions, database integration tests, critical Playwright journeys, TypeScript, and the production
  build. Inspect test scripts before running them; local suites must use isolated local services and must never target production.

  ### Production verification

  First identify the linked deployment, its application revision, database migration state, and required service configuration without exposing
  credentials. Deploy verified fixes and apply only genuinely new required migrations.

  The user authorizes clearly labelled isolated production test records, test uploads, and recovery/test emails to emmanuelezenwigbo@gmail.com using
  a dedicated test staff account. Do not reset an existing real staff account or send test messages to customers.

  Verify and document:

  - Staff sign-in and complete password recovery: email receipt, recovery link, password change, and successful subsequent sign-in.
  - R2 upload/download behavior, image processing, denied anonymous object access, and actual signed-URL expiration.
  - Capability isolation using distinct test records: correct-context access, tampering rejection, completion, replacement, expiration, and absence
    of client uploads or internal data.

  - Invoice and vendor-brief PDF generation, correct permissions/content, and metadata-only persistence.
  - Cron rejection for absent/incorrect credentials and success of authenticated ?dryRun=1.
  - An actual scheduled cron invocation through deployment logs and its persisted outcome. A manual call or dry run alone does not satisfy scheduled
    verification.

  - Existing Resend delivery evidence; use newly authorized messages only where needed to validate the deployed workflow.

  Inspect existing scheduled-run logs first. If fresh observation is necessary, use available monitoring mechanisms and keep the task pending until
  evidence arrives.

  Archive test operational records under existing lifecycle rules and record retained test artifacts. Do not permanently delete production data or
  introduce purge behavior.

  ## 4. Close the checklist and hand off

  - Build [x]: implemented and inspected.
  - Test [x]: verified through an identified passing check or documented live observation.
  - [~]: precise remaining work is stated.
  - [ ]: unverified or incomplete.
  - Deferred/not applicable: explicit explanation and spec reference outside the active completion count.

  Before declaring completion:

  1. Reconcile every original checklist row against the final ledger; no unexplained removals or unsupported checkmarks.
  2. Close all applicable acceptance criteria in the 17 task files and replace stale ready-for-agent statuses.
  3. Update release and notification documentation to reflect actual migration, deployment, and scheduled-run evidence.
  4. Confirm the deployed revision contains the verified fixes.
  5. Report final checklist totals, test results, deployment reference, live evidence, and retained test artifacts.

  Missing access, inbox interaction, or scheduled-run evidence is a specific unresolved dependency—not a completed checkbox. Request only the
  missing input, continue independent work, and do not claim completion while applicable items remain pending.
