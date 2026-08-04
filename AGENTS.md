# Kuartz Fashion CRM

## Source of truth

- Read `PRODUCT_ARCHITECTURE_SPEC.md` before making product or architecture changes.
- Treat that document as the Phase 1 product source of truth. Do not silently expand deferred scope.
- When implementation and the spec disagree, preserve user data, call out the mismatch, and prefer the spec for new work.
- Do not decide items in **Open Decisions** without explicit product direction. Design seams that keep those choices reversible.

## Current repository

This repository currently implements a small external-intake vertical slice:

- `/` is an internal demo page for generating intake links and viewing submissions.
- `/i/[token]` and `/intake/[token]` expose the client intake form.
- `lib/magic-links.ts` stores one-use, seven-day tokens in Upstash Redis when configured and falls back to an in-memory development store.
- Submitted intake records are Enquiries in product language, even where legacy code calls them submissions.

Preserve working intake behavior while migrating toward the full CRM. Prefer small vertical slices over a broad rewrite.

## Stack and commands

- Next.js App Router, React, and strict TypeScript
- Tailwind CSS; use shadcn/ui and lucide-react for new application UI
- Supabase Auth and Postgres
- Drizzle for schema, migrations, and server-side queries
- Cloudflare R2 for uploaded file bytes; Postgres stores file metadata
- Resend for transactional email
- Vercel Cron plus route handlers for scheduled notifications
- Vitest for business logic; add Playwright only for critical end-to-end flows

Run the narrowest relevant checks, then the full checks before handoff:

```bash
npm run typecheck
npm run build
```

Add test and database scripts when those tools are introduced. Never hand-edit generated migrations.

## Architectural boundaries

- Use the Supabase client only for operations that are safe under RLS.
- Put sensitive business operations in server actions, route handlers, or server-only modules.
- Sensitive operations include payments and balance validation, magic-link issuance and consumption, R2 signing, overrides, PDF generation, notification scheduling, and deletes.
- Enforce permissions in server code and RLS. UI hiding is supplementary, not authorization.
- Keep secrets and privileged Supabase/R2 clients server-only.
- Core records must carry `organization_id`, even though Phase 1 presents a single-tenant UI.
- Store money in integer minor units. Never use floating-point arithmetic for balances.
- Store timestamps in UTC and format them for the user’s locale at the boundary.
- Use transactions for multi-record invariants such as Enquiry conversion and payment updates.
- Uploaded objects are private and accessed through short-lived signed URLs. Compress or resize images before upload.
- Generated invoice and vendor-brief PDFs are ephemeral in Phase 1; store export metadata, not the PDFs or snapshots.

## Domain language and invariants

Use these canonical names in schema, code, and UI:

```text
Enquiry -> conversion -> Client + Active Order
Client -> Orders -> Looks -> Items -> Vendor Assignment
Order -> Accessory Sourcing -> Accessory Items
```

- An Enquiry is lightweight. It must not own style files, measurements, vendor assignments, payments, production, accessories, or fittings.
- Conversion requires a final agreed price, primary owner, and at least one Look. Create the Client and Active Order atomically.
- Never auto-merge people. Phone/email matches are strong duplicate warnings; similar-name matches are weak warnings.
- A Look belongs to one Order. An Item belongs to one Look. Vendor assignment is item-level, with one vendor per item in Phase 1.
- Style Direction Files apply to the whole Order or one Look. Revisions belong to a stable file record.
- Approval decisions are per file revision. `With Revisions` and `Rejected` require a client comment.
- A newer approval request invalidates older pending requests for the same context. Magic links expire on completion or after seven days.
- Client magic links are scoped, one-off capabilities, not client accounts. Store only token hashes.
- Measurement values are flexible and historical. Item-type templates determine required measurements.
- Vendor brief export is blocked by missing required measurements unless a Super Admin supplies an audited override reason.
- Production state lives on the item/vendor assignment. Production status options are configurable and archivable.
- Order balance is invoice total minus client payments. Vendor balance is agreed vendor cost minus vendor payments.
- An Order with a positive client balance cannot be completed/delivered unless a Super Admin supplies an audited override reason.
- Final agreed price is the financial source of truth. Friends & Family discount amount is informational only.
- One Order has one Invoice in Phase 1.
- Accessory Items do not enter the vendor-brief or production workflow.

## Roles and audit

There are exactly two Phase 1 roles:

- `Super Admin`: full access, sensitive edits/deletes, settings, team roles, and overrides.
- `Admin Assistant`: operational create/update work, uploads, notes, statuses, and approval links; no reserved destructive or financial authority.

Record important actions in the audit log, including payment mutations, overrides, approval decisions, brief exports, role changes, conversion/completion, invoice sent/voided, and file revision replacement. Audit entries need actor, action, entity type/id, timestamp, and a useful summary.

## Data modeling conventions

- Use UUID primary keys and explicit foreign keys.
- Include `created_at` and `updated_at` on mutable core records.
- Prefer database constraints for structural invariants and domain services for rules involving several records or roles.
- Use stable machine values for statuses and map them to human-readable labels in the UI.
- Configurable statuses/types need sort order, an archive flag/timestamp, and any required semantic marker such as `is_completed`.
- Avoid hard-coded production, specialty, or accessory option lists outside seed/default configuration.
- Preserve history by appending revision, status-history, measurement-history, payment, and audit records rather than overwriting evidence.
- Index organization scoping, foreign keys, normalized phone/email lookup, token hashes, status filters, and due dates.
- Decide delete behavior only after the open delete-strategy decision is resolved.

## UI expectations

- Build responsive desktop/mobile workflows and retain installable-PWA compatibility; Phase 1 requires a network connection.
- Show optional fields with `(optional)` in the label.
- Client pickers show name, phone, email, and active/latest order.
- Production views group Client -> Order -> Look -> Item and support the filters in the spec; do not add a Kanban view in Phase 1.
- Derive urgency from dates rather than adding a manual priority field.
- Client-facing magic-link pages expose only the records and actions authorized by that link and never allow uploads.
- Keep internal consultation and production notes out of client views and vendor brief PDFs.
- Maintain accessible labels, keyboard focus, semantic controls, useful empty/error states, and reduced-motion behavior.

## Testing priorities

Keep business rules in pure functions or focused services so they can be tested without rendering UI. Prioritize tests for:

- invoice, payment, and balance calculations
- magic-link expiry, completion, and replacement
- server-side role permissions and Super Admin overrides
- measurement requirement checks and vendor-brief blockers
- approval comment validation
- notification due-date windows
- atomic Enquiry conversion

Every bug fix should include a regression test when the behavior can be isolated reasonably.

## Scope discipline

Do not add these in Phase 1 unless the spec is updated:

- client accounts, vendor portal, vendor magic links, or client uploads
- stored generated PDFs or vendor-brief snapshots
- multiple invoices per Order
- formal lead grading, style-complete status, challenge log, vendor capacity, or manual production priority
- item-assignment uploads, vendor availability notes, Kanban, SMS, or offline sync
- collaborators or internal priority on internal Enquiries

Before building Fitting, Vendor Rating, or unresolved Accessory behavior, ask for the missing product decisions or work only within the explicitly known requirements.
