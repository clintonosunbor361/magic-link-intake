# Kuartz Workflow V3 — Phase 1 Product Specification

## Problem Statement

Kuartz needs one coherent CRM workflow for taking a person from first contact through styling, production, delivery, and vendor evaluation. The supplied Workflow V3 describes the operational journey, but some of its language and sequencing predates the newer Client-first product architecture. Without a reconciled specification, the product can expose overlapping concepts, attach work at the wrong level, share internal information accidentally, or expand deferred Phase 1 scope.

The product must let Kuartz capture a Client quickly, create an Order only after price is agreed, progressively add operational detail, coordinate item-level vendor work, track financial and deadline risk, and involve the Client through tightly scoped magic links. It must preserve history and enforce permissions without turning early contact capture into a formal lead pipeline.

## Solution

Provide a responsive, organization-scoped CRM organized around the canonical hierarchy:

```text
Client -> Orders -> Looks -> Items -> Vendor Assignment
Order -> Accessory Sourcing -> Accessory Items
```

The Phase 1 journey is:

1. Capture a person as a Client through an internal or external intake form.
2. Track lightweight Client to-dos while price and scope are discussed outside the app.
3. Once final price is agreed, create an Active Order with an owner and at least one Look.
4. Develop Style Direction through internal consultation notes and revisioned files, sharing only selected file revisions for Client approval.
5. Maintain the Client’s reusable Measurement Profile, define Looks and Items, and optionally request Client confirmation of measurements or Order details.
6. Assign one Vendor to each Item, prepare a selectively disclosed Vendor Brief PDF, and track item-level production deadlines, statuses, notes, and Vendor payments.
7. Source Accessory Items separately from the production workflow.
8. Schedule Fitting Sessions, capture internal corrections, request Client confirmation, and deliberately share selected fitting instructions with Vendors.
9. Track the Invoice, Client payments, Vendor payments, and completion balance gate.
10. Prompt staff to rate each Vendor who worked on a completed Order.
11. Surface due, delayed, awaiting, and financial work through dashboard notifications and email reminders.

The workflow is progressive: creating an Order does not require Kuartz to complete every later stage immediately. Client-facing links are one-off, scoped capabilities rather than Client accounts. Internal records remain private unless a staff member deliberately selects them for an approved export or confirmation surface.

## User Stories

1. As a Kuartz staff member, I want to create a Client immediately when someone reaches out, so that every contact has a durable record before an Order exists.
2. As a Kuartz staff member, I want to send an expiring intake link, so that a potential Client can provide their own contact and event details.
3. As a Kuartz staff member, I want to complete the same intake in-house, so that phone, WhatsApp, walk-in, and in-person enquiries follow one Client-first model.
4. As a potential Client, I want to submit my name, phone, email, preferred contact channel, event type, budget range, and brief, so that Kuartz understands my request.
5. As a potential Client, I want to identify whether my WhatsApp number matches my primary phone, so that Kuartz contacts the correct number.
6. As a Kuartz staff member, I want external and internal intake to create the same type of Client record, so that no separate lead pipeline must be reconciled later.
7. As a Kuartz staff member, I want strong duplicate warnings for matching phone numbers or emails, so that I notice likely duplicate records.
8. As a Kuartz staff member, I want weak duplicate warnings for similar names, so that I can distinguish coincidence from a likely duplicate.
9. As a Kuartz staff member, I want duplicate warnings to require acknowledgment without automatically merging people, so that legitimate same-name or shared-contact Clients remain separate.
10. As a Kuartz staff member, I want Client pickers to show name, phone, email, and latest or active Order, so that I choose the correct person.
11. As a Kuartz staff member, I want to filter Clients by whether they have Orders, so that contacts without confirmed work stay easy to find.
12. As a Kuartz staff member, I want to create and complete Client to-dos with a due date, assignee, and optional note, so that lightweight follow-up is visible without a formal sales pipeline.
13. As a Kuartz staff member, I want open Client to-dos sorted by closest due date, so that the next follow-up is obvious.
14. As a Kuartz staff member, I want to create an Order only after final price and scope are agreed, so that unconfirmed contacts remain lightweight Clients.
15. As a Kuartz staff member, I want to create an Order from a Client profile, so that the Client relationship is explicit and duplicate selection is avoided.
16. As a Kuartz staff member, I want a secondary standalone Order flow with a Client picker, so that I can start from the Orders area when appropriate.
17. As a Kuartz staff member, I want Order creation to require a title, event type, final agreed price, primary owner, and at least one Look, so that every Active Order has enough structure to operate.
18. As a Kuartz staff member, I want to add several Look names while creating an Order, so that multi-look events are represented without requiring Item details immediately.
19. As a Kuartz staff member, I want to add Items after Order creation, so that early setup stays quick while outfit details evolve.
20. As a Kuartz staff member, I want the Order workspace to land on an Overview tab with practical next actions, so that I know what remains incomplete.
21. As a Kuartz staff member, I want separate Order workspace areas for Looks and Items, Style Direction, Measurements, Vendors, Production, Accessories, Fittings, and Payments, so that each operational concern has a clear home.
22. As a Kuartz staff member, I want to record a Friends & Family marker and optional informational discount amount, so that context is visible without changing the agreed-price source of truth.
23. As a Kuartz staff member, I want to record internal Consultation Notes on an Order or a specific Look, so that calls, meetings, WhatsApp discussions, sketches, and colour references are documented.
24. As a Kuartz staff member, I want consultation-note sources to be configurable, so that Kuartz can adapt the capture vocabulary without code changes.
25. As a Kuartz staff member, I want Consultation Notes to remain internal by default, so that production or private commentary never leaks to the Client.
26. As a Kuartz staff member, I want note history preserved after a note has informed an export, so that later edits do not erase operational evidence.
27. As a Kuartz staff member, I want to upload Moodboards, Sketches, Fabric References, Colour References, and other Style Direction Files, so that creative work is attached to the Order.
28. As a Kuartz staff member, I want a Style Direction File to apply to the whole Order or one Look, so that its context is unambiguous.
29. As a Kuartz staff member, I want to add revisions to one stable Style Direction File, so that versions remain easy to compare and reconcile.
30. As a Kuartz staff member, I want to decide whether each Style Direction File requires Client approval, so that internal references do not create unnecessary approval work.
31. As a Kuartz staff member, I want to batch several eligible files into one approval request, so that the Client can review related creative work together.
32. As a Client, I want an approval page grouped by whole-Order files and Look, so that I understand what each file applies to.
33. As a Client, I want to approve, approve with revisions, or reject each requested file revision, so that my decision is precise.
34. As a Client, I want to provide a required comment when requesting revisions or rejecting a file, so that Kuartz knows what must change.
35. As a Kuartz staff member, I want newer approval requests to invalidate older pending requests for the same context, so that the Client cannot decide against stale work.
36. As a Kuartz staff member, I want the latest approved or action-required revision to be visually clear, so that I do not send or produce from the wrong version.
37. As a Kuartz staff member, I want to maintain one flexible Measurement Profile on the Client, so that measurements can be reused across Orders.
38. As a Kuartz staff member, I want to edit Client measurements from either the Client profile or an Order workspace, so that operational work does not require navigation away from the Order.
39. As a Kuartz staff member, I want measurement changes to append history with previous value, new value, author, date, and optional note, so that historical evidence is preserved.
40. As a Super Admin, I want configurable Measurement Fields and Item Types, so that Kuartz can adapt measurement requirements to its work.
41. As a Kuartz staff member, I want Items to use configured Item Types such as Suit, Agbada, Shirt, Trouser, Cap, or Shoes, so that measurement rules can be evaluated consistently.
42. As a Kuartz staff member, I want required measurements calculated per Item Type, so that I can see what is missing before work is sent to a Vendor.
43. As a Kuartz staff member, I want to upload private measurement-reference images, so that handwritten sheets can supplement structured values.
44. As a Kuartz staff member, I want images compressed or resized before private upload, so that storage use remains controlled.
45. As a Kuartz staff member, I want to send a Measurement Profile confirmation link, so that a Client can confirm or request correction without receiving an account.
46. As a Client, I want measurement confirmation to be read-only except for confirm or correction request, so that the source record cannot be edited through the link.
47. As a Client, I want to provide a required comment when requesting a measurement correction, so that the requested change is actionable.
48. As a Kuartz staff member, I want to send Order details for Client confirmation, so that the Client can confirm the title, Looks, Items, final price, and selected key notes.
49. As a Client, I want to confirm Order details or request correction with a comment, so that Kuartz has an explicit decision.
50. As a Kuartz staff member, I want Client confirmation to remain optional before Vendor assignment, so that production coordination is not blocked unnecessarily.
51. As a Kuartz staff member, I want to create and maintain a Vendor directory, so that Vendors exist independently of individual assignments.
52. As a Kuartz staff member, I want Vendor pickers to show specialties, rating breakdown, completed and open jobs, and last job date, so that assignment decisions use relevant history.
53. As a Kuartz staff member, I want to quick-create a Vendor with minimal information during assignment, so that an operational flow is not interrupted.
54. As a Kuartz staff member, I want to assign one Vendor to each Item, so that responsibility and production state are precise.
55. As a Kuartz staff member, I want to bulk assign one Vendor across Items in a Look, so that common assignments are fast without changing the item-level model.
56. As a Kuartz staff member, I want every Vendor Assignment to have its own production deadline, status, agreed Vendor cost, and payment position, so that risk and liability are visible per Item.
57. As a Kuartz staff member, I want production statuses to be configurable, ordered, archivable, and capable of marking completion, so that the workflow can evolve safely.
58. As a Kuartz staff member, I want each production-status change to append history, so that the progression of Vendor work remains auditable.
59. As a Kuartz staff member, I want internal Production Notes on an Item’s Vendor Assignment, so that issues and updates are recorded without exposing them to Clients or Vendor Briefs.
60. As a Kuartz staff member, I want production work grouped Client to Order to Look to Item, so that context remains visible at every level.
61. As a Kuartz staff member, I want production filters for Vendor, status, due date, overdue state, and Client, so that I can focus on the work requiring action.
62. As a Kuartz staff member, I want urgency derived from production deadlines, so that overdue and near-due work is highlighted without a manual priority field.
63. As a Kuartz staff member, I want a Vendor Brief prefilled from selected Order, Look, Item, Style Direction, Measurement, and Consultation Note data, so that information is not retyped.
64. As a Kuartz staff member, I want the Vendor Brief exporter to start with nothing shared by default and require deliberate field selection, so that private or irrelevant information is not leaked.
65. As a Kuartz staff member, I want to edit the Vendor Brief presentation without silently changing source records, so that one export can be tailored safely.
66. As a Kuartz staff member, I want Vendor Brief export blocked when required measurements are missing, so that a Vendor does not receive incomplete production instructions.
67. As a Super Admin, I want to override a missing-measurement block with a required reason, so that exceptional work can proceed with accountability.
68. As a Kuartz staff member, I want to export the Vendor Brief as an ephemeral PDF and record export metadata, so that I can share it externally without storing generated snapshots.
69. As a Kuartz staff member, I want to create one Invoice per Order using manual line items, so that Client billing reflects the final agreed work.
70. As a Kuartz staff member, I want invoice totals and balances calculated in integer minor units, so that financial arithmetic is exact.
71. As a Kuartz staff member, I want to record Client payments against the Order Invoice, so that outstanding Client balance is current.
72. As a Kuartz staff member, I want mismatched or overpaid amounts brought to my attention, so that financial discrepancies are not silently accepted.
73. As a Kuartz staff member, I want to record Vendor payments and private receipt uploads against a Vendor Assignment, so that Vendor liabilities and evidence remain together.
74. As a Kuartz staff member, I want Vendor balance calculated from agreed Vendor cost minus live Vendor payments, so that the amount owed is accurate.
75. As a Kuartz staff member, I want an Order with a positive Client balance blocked from completion or delivery, so that unpaid work is not closed accidentally.
76. As a Super Admin, I want to override the completion balance gate with a required reason, so that legitimate exceptions are possible and audited.
77. As a Kuartz staff member, I want Accessory Sourcing separate from Vendor production, so that sourced products do not enter Vendor Brief or production-status workflows.
78. As a Kuartz staff member, I want an Accessory Item linked to the whole Order or a specific Look, so that its intended context is clear.
79. As a Kuartz staff member, I want configurable and archivable Accessory Types and statuses, so that the sourcing vocabulary can evolve without hard-coded lists.
80. As a Kuartz staff member, I want to create a custom-labelled Accessory Item when the configured type is Other, so that uncommon requests are still captured.
81. As a Kuartz staff member, I want to track assigned staff, supplier, budget in minor units, purchase date, derived delivery date, status, and notes for an Accessory Item, so that sourcing responsibility and progress are visible.
82. As a Kuartz staff member, I want a Look-scoped Accessory’s delivery date derived from that Look’s date, so that schedule changes remain synchronized.
83. As a Kuartz staff member, I want a whole-Order Accessory’s deadline derived from the earliest dated active Look until product direction changes, so that it has a deterministic reminder date.
84. As a Kuartz staff member, I want to schedule repeat Fitting Sessions on an Order and optionally scope each session to a Look, so that multiple appointments are represented correctly.
85. As a Kuartz staff member, I want to record fitting time, location, status, internal notes, corrections, and adjustments, so that the fitting outcome is actionable.
86. As a Kuartz staff member, I want fitting reschedules and status changes to append history, so that appointment changes remain recoverable.
87. As a Kuartz staff member, I want to write a deliberate Client-facing fitting summary separate from internal notes, so that only intended information appears in Client confirmation.
88. As a Kuartz staff member, I want to send a fitting confirmation link, so that the Client can confirm the fitting outcome or request correction.
89. As a Client, I want to confirm the fitting outcome or request correction with a required comment, so that agreed adjustments are explicit.
90. As a Kuartz staff member, I want an intentional way to select and share fitting corrections with the responsible Vendor, so that internal notes are not forwarded wholesale.
91. As a Kuartz staff member, I want a rating prompt for each Vendor who worked on a completed Order, so that evaluation happens while the work is fresh.
92. As a Kuartz staff member, I want to rate Vendor Quality, Timeliness, and Communication from 1 to 5, so that future selection has consistent evidence.
93. As a Kuartz staff member, I want one rating per Order and Vendor, so that one job does not distort the Vendor’s record through duplicates.
94. As a Kuartz staff member, I want rating revisions to preserve previous and new scores, so that corrected judgments remain auditable.
95. As a Kuartz staff member, I want Vendor rating summaries and job counts visible during selection, so that prior performance informs assignment.
96. As a Kuartz staff member, I want dashboard reminders 7, 3, and 1 days before eligible deadlines and an overdue alert afterward, so that important work is not missed.
97. As a Kuartz staff member, I want Phase 1 reminders delivered through dashboard notifications and email, so that action is visible in-app and in the inbox.
98. As a Kuartz staff member, I want reminders for Client to-dos, Vendor Assignment deadlines, Accessory deadlines, and Fitting Sessions, so that deadline behavior is consistent across modules.
99. As a Kuartz staff member, I want date changes to re-arm the appropriate reminder schedule without duplicating unchanged notifications, so that reminders stay accurate.
100. As a Kuartz staff member, I want the dashboard to show active Clients, upcoming Look dates, upcoming Fittings, delayed production, pending Client responses, and open to-dos, so that operational risk is visible at a glance.
101. As a Kuartz staff member, I want the dashboard to show outstanding Client balances and Vendor payment summaries, so that financial exposure is visible.
102. As a Kuartz staff member, I want event countdowns derived from Look dates, so that urgency changes automatically as an event approaches.
103. As a Super Admin, I want full operational, financial, destructive, settings, role, and override authority, so that exceptional and sensitive work is controlled.
104. As an Admin Assistant, I want operational create and update access without reserved destructive or financial authority, so that routine work can proceed safely.
105. As an organization member, I want all core records scoped to my organization, so that data cannot cross organizational boundaries.
106. As a Super Admin, I want important financial, override, approval, export, role, completion, and revision actions audited, so that sensitive activity is accountable.
107. As a Client using a magic link, I want to see only the records and actions authorized by that link, so that internal CRM information remains private.
108. As a Client using a magic link, I want links to expire after completion or seven days, so that old capabilities cannot be reused.
109. As a Client using the CRM on a phone, I want readable forms, semantic controls, useful errors, and no horizontal overflow, so that I can complete decisions confidently.
110. As a Kuartz staff member, I want responsive desktop and mobile workflows with keyboard focus and reduced-motion support, so that the CRM remains accessible in different working contexts.

## Implementation Decisions

- `PRODUCT_ARCHITECTURE_SPEC.md` remains the Phase 1 source of truth. Workflow V3 supplies journey intent and explicit operational requirements, but it does not override newer architecture silently.
- The canonical aggregate path is Client -> Orders -> Looks -> Items -> Vendor Assignment. Accessory Sourcing belongs to an Order but remains separate from Items and Vendor Assignment.
- Intake creates a Client immediately. There is no separate Enquiry, lead-grade, or formal lead-pipeline entity in Phase 1.
- Style Direction starts only after an Active Order exists. Final agreed price, primary owner, and at least one Look are required to create that Order.
- The Order workspace is progressive and tabbed. Overview is the landing surface and should show missing setup and practical next actions without blocking navigation unnecessarily.
- Consultation Notes are internal. A note can apply to the Order or a Look and may be selected deliberately for a Vendor Brief, but is never included by default and is not sent for Client approval.
- Moodboards, sketches, fabric references, colour references, and other creative uploads share one Style Direction File model. A stable file owns append-only revisions.
- Approval decisions attach to the exact requested file revision. Approval requests may batch files, but each file receives its own decision. Resending supersedes older pending requests for the same context.
- The Client Measurement Profile is reusable across Orders. Order workspace measurement editing writes to the same Client profile and append-only history.
- Item Type configuration defines measurement requirements. Vendor Brief eligibility is evaluated against each assigned Item’s active type requirements.
- Order-detail, measurement, fitting, and Style Direction Client interactions use scoped magic-link capabilities. Only token hashes are stored; links expire on completion or after seven days and never permit Client uploads.
- Vendor Assignment is item-level with one Vendor per Item in Phase 1. Bulk assignment is a convenience that creates or updates item-level assignments rather than introducing a Look-level assignment entity.
- Production status and deadline live on Vendor Assignment. Status history is append-only; urgency is derived from dates; there is no manual priority or Kanban view.
- Vendor Briefs are composed from current structured source data, selectively disclosed, reviewed, and exported as ephemeral PDFs. Export metadata is stored; generated PDFs and snapshots are not.
- Consultation Notes may be selected for a Vendor Brief. Production Notes and fitting internal notes are excluded. No note category is included by default.
- Fitting instructions for Vendors require an intentional selection/share boundary separate from internal fitting notes. The delivery mechanism and document format remain reversible until explicitly chosen.
- Final agreed price is the financial source of truth. The Friends & Family discount amount is informational only.
- One Order has one Invoice in Phase 1. Invoice and balance arithmetic uses integer minor units; payment mutations and completion overrides run server-side and are audited.
- Accessory Items do not use Vendor Briefs, Vendor Assignments, production statuses, or Vendor payment records.
- Workflow V3 explicitly adds assigned staff, supplier, budget, and purchase date to Accessory Items. These fields should be implemented as sourcing metadata without turning the supplier into a production Vendor Assignment. Budget is stored in integer minor units.
- Accessory delivery dates follow the established derived-date rule rather than introducing an independent stored date: a Look-scoped Accessory inherits that Look’s date; a whole-Order Accessory inherits the earliest dated active Look. The PDF’s independent delivery-date wording remains a recorded conflict, not a silent schema change.
- Fitting Sessions belong to an Order and may optionally belong to one Look. A reschedule updates the stable session and appends history; a repeat fitting creates another session.
- Client-facing fitting content is stored separately from internal fitting notes. Client confirmation covers the outcome and agreed adjustments, not appointment acceptance.
- Vendor Ratings use Quality, Timeliness, and Communication scores from 1 to 5. There is one live rating per Order and Vendor, with append-only revisions for edits.
- Completion of an Order surfaces pending rating prompts for Vendors who worked on the Order.
- Notifications are idempotent by source, source record, trigger, and due date. Rescheduling creates eligibility for the new date without duplicating reminders for an unchanged date.
- Phase 1 notification channels are dashboard and email. SMS from Workflow V3 is deferred.
- Dashboard calculations derive from canonical records and business dates in the organization timezone. Stored timestamps remain UTC and are formatted at the user boundary.
- Sensitive operations live in server actions, route handlers, or server-only modules. The Supabase client is limited to operations safe under RLS.
- Core records use UUID primary keys, explicit foreign keys, organization scoping, timestamps, optimistic version checks, and archive/history behavior consistent with existing architecture decisions.
- Private upload bytes live in Cloudflare R2; Postgres stores metadata. Access uses short-lived signed URLs, and image inputs are compressed or resized before upload.
- Permissions are enforced in server code and RLS. UI hiding is supplementary. Secrets and privileged database or storage clients remain server-only.
- Important actions create audit entries containing actor, action, entity type and ID, UTC timestamp, and a useful summary. Required coverage includes payment mutations, overrides, Client decisions, brief exports, role changes, Order completion, invoice sent or voided, and file revision replacement.
- Configurable lists use stable machine identifiers, human-readable labels, sort order, and archive state. Production and Accessory statuses also carry the semantic completion marker required by their workflows.
- Optional UI fields include `(optional)` in their labels. Client-facing pages contain no production notes, internal notes, financial internals beyond expressly confirmed Order price, or upload controls.

## Testing Decisions

- Tests assert externally visible business behavior rather than component internals, SQL string shape, or incidental implementation details. A good test proves an actor can or cannot complete a meaningful workflow and that durable state reflects the stated invariant.
- The primary acceptance seam is one authenticated staff journey against local Supabase: create a Client, create an Order and Looks, add Items, add Style Direction and a revision, complete a Client decision through a magic link, add measurements, assign a Vendor, export a Vendor Brief, progress production, record payments, complete the Order, and record the Vendor rating.
- The same acceptance seam includes focused branches for external intake and Client-facing magic links. It asserts that the Client sees only authorized content and cannot upload or access internal notes.
- The highest practical browser seam uses Playwright only for critical cross-module flows, responsive navigation, magic-link decisions, authorization boundaries, and PDF download behavior.
- Focused Vitest service tests cover rules that need fast and precise diagnosis: duplicate warnings, Order creation invariants, optimistic concurrency, approval comment validation, superseded magic links, measurement blockers, status transitions, reminder windows, payment arithmetic, completion gates, Accessory date derivation, Fitting transitions, and Vendor rating revisions.
- Repository and database tests verify organization scoping, foreign keys, structural uniqueness, RLS policies, archive behavior, append-only history, and index-backed query paths.
- PDF document tests assert selected content, exclusion of internal content, escaping of user-supplied values, and metadata. They do not compare unstable binary PDF bytes.
- Notification tests freeze the organization business date and assert 7-day, 3-day, 1-day, overdue, reschedule, deduplication, and email-eligibility behavior deterministically.
- Financial tests operate exclusively in integer minor units and cover exact totals, partial payments, overpayments, voided payments, balance calculations, and Super Admin completion overrides.
- Authorization tests exercise server-side role enforcement for both Super Admin and Admin Assistant; UI visibility alone is never accepted as proof of authorization.
- Regression tests are added for every isolatable bug. Existing service-test, RLS-test, PDF-rendering, notification-planning, and local-Supabase patterns are the preferred prior art.
- Verification runs the narrowest affected suite first, followed by the full unit suite, database/RLS checks when schema changes, critical Playwright journeys when a cross-boundary flow changes, `npm run typecheck`, and `npm run build`.

## Out of Scope

- Client accounts, Client uploads, a Vendor portal, Vendor accounts, or Vendor magic links.
- SMS notifications in Phase 1.
- Offline synchronization or offline editing; installable PWA compatibility still requires a network connection.
- Multiple Invoices per Order, staged Invoices, or a Vendor invoice system.
- Stored generated Invoice PDFs, stored Vendor Brief PDFs, or stored Vendor Brief snapshots.
- A separate Enquiry or lead pipeline, formal lead grading, manual production priority, or a challenge log.
- Vendor capacity planning, Vendor availability notes, item-assignment uploads, or Kanban production views.
- Accessory Items entering Vendor Brief, production, or Vendor-payment workflows.
- Automatically merging Clients based on name, phone, email, or any similarity score.
- A formal Style Direction-complete status.
- General-purpose file sharing from internal notes or automatic forwarding of Fitting Notes to Vendors.
- Finalizing the delivery channel or file format for selected Vendor-facing fitting corrections without further product direction.
- Replacing derived Accessory deadlines with independently editable delivery dates without resolving the recorded conflict.
- General real-time synchronization, a final delete/purge policy, hosting changes, or rules that warn or block multiple simultaneous Active Orders.

## Further Notes

The supplied Workflow V3 PDF was created on June 27, 2026. The repository’s product architecture was updated on August 22, 2026 and therefore governs conflicts.

| Workflow V3 statement | Adopted Phase 1 interpretation |
| --- | --- |
| Style Direction occurs before budget and pricing agreement | A Client may exist before agreement, but Style Direction belongs to an Active Order created only after final price is agreed. |
| Consultation Notes are sent to the Client for approval | Consultation Notes are internal. Only selected Style Direction File revisions enter Client approval. |
| Each Client Order is assigned to the best Vendor | Each Item receives one Vendor Assignment; Look-level assignment is only a bulk convenience. |
| Production status is tracked per Vendor or Order | Production status and deadline are tracked per Item’s Vendor Assignment. |
| Reminder channels include email, SMS, and dashboard | Phase 1 supports email and dashboard; SMS is deferred. |
| Every Accessory Item has a delivery date | Delivery date is derived from its linked Look or the earliest dated active Look for whole-Order Accessories; an independent date requires a later decision. |
| Fitting corrections are shared with the Vendor | Sharing must be deliberate and selective; internal Fitting Notes are not shared automatically. |
| Moodboards and sketches appear as separate workflow systems | Both use one revisioned Style Direction File system with different categories. |

The current codebase already implements much of the domain and persistence foundation. The main delivery emphasis for this specification is end-to-end workflow coherence, Order workspace UX, explicit sharing boundaries, and acceptance coverage across the existing modules rather than a broad rewrite.

Open decisions remain reversible: delete strategy, real-time freshness, multiple-active-Order warning behavior, final hosting choice, final Accessory delivery-date behavior, the Vendor-facing fitting-correction delivery mechanism, and any Vendor Rating details beyond the three established criteria and revision history.
