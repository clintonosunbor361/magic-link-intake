# Kuartz Fashion CRM - Product and Architecture Spec

Last updated: July 5, 2026

## 1. Product Summary

Kuartz Fashion CRM is an internal operations app for managing fashion styling work after a potential client enters the system. Kuartz sits between clients and vendors; vendors produce the items, while Kuartz manages styling, coordination, approvals, payments, deadlines, and delivery.

Phase 1 focuses on a lightweight enquiry process and a structured active-order workflow.

## 2. Core Journey

1. A person enters the system through external or internal intake.
2. They become an `Enquiry`.
3. Kuartz follows up outside the app through WhatsApp, calls, or in-person conversation.
4. Enquiry follow-up notes and to-dos can be tracked lightly in the app.
5. Once price is agreed, Kuartz converts the Enquiry into a `Client` plus an `Active Order`.
6. The full workflow starts from the Active Order: style direction, measurements, looks/items, vendor assignment, production, accessories, fitting, payments, and vendor rating.

## 3. Roles and Users

There are two roles:

- `Super Admin`: full access, including settings, team management, payment edits/deletes, overrides, and major deletes.
- `Admin Assistant`: can manage operational records, upload files, send approval links, update statuses, add notes, and create records. Cannot perform sensitive/destructive actions reserved for Super Admin.

The app may have more than two users. Users are assigned one of the two roles.

## 4. Enquiries and Intake

### Enquiry Concept

An `Enquiry` is a lightweight record for someone who entered the system but has not yet become a paying/confirmed client. It is mainly for capturing customer information, not for grading or qualifying leads.

Enquiries do not have:

- Style direction files
- Moodboards/sketches
- Measurements
- Vendor assignments
- Payments
- Production workflow
- Accessories
- Fittings

### External Intake

External form creates an Enquiry.

Fields:

- Full name
- Primary phone
- WhatsApp same as primary
- WhatsApp number, if different
- Email
- Preferred contact channel
- Event type
- Budget range
- Brief / what they need help with

### Internal Intake

Internal intake also creates an Enquiry.

Fields:

- Full name
- Primary phone
- WhatsApp same as primary
- WhatsApp number, if different
- Email
- Preferred contact channel
- Event type
- Budget range
- Brief / what they need help with
- Lead source
- Primary owner
- Internal notes

Internal intake should not include collaborators or internal priority in Phase 1.

### Enquiry Follow-Up

Enquiries can have lightweight follow-up notes:

- Date
- Note
- Created by
- Optional next follow-up date

Enquiries can also have simple to-dos/reminders:

- Task title
- Due date
- Assigned to
- Status: `Open` / `Done`
- Optional note

## 5. Client and Order Model

### Conversion

An Enquiry converts into:

- `Client`
- `Active Order`

Final agreed price is required before creating an Active Order.

### Active Order Required Fields

- Client
- Order title
- Event type
- Final agreed price
- Primary owner
- At least one Look

### Structure

```text
Client
  Orders
    Looks
      Items
```

There is no separate required Event/Moment layer in Phase 1.

Example:

```text
Order: Tayo Wedding
  Look: Traditional Wedding
    Item: Agbada
    Item: Cap
  Look: Reception Look
    Item: Suit
```

### Look Fields

- Look name
- Optional look date
- Notes
- Items

### Item Fields

- Item type/name
- Quantity
- Assigned vendor later
- Production status later

## 6. Duplicate Handling and Search

Duplicate detection:

- Same phone or email: strong duplicate warning
- Same/similar name only: weak warning
- Never auto-merge clients automatically

Search and client picker rows should show:

- Name
- Phone
- Email
- Active/latest order

Phone number should be visible in client pickers to distinguish same-name clients.

## 7. Stage 2 - Style Direction

Style Direction happens inside an Active Order, not inside Enquiry.

### Consultation Notes

Consultation notes are internal only.

Notes have a `source`, and the selected source determines input fields.

Sources may include:

- In-person consultation
- Phone call
- WhatsApp
- Email
- Sketch reference
- Colour reference
- Other

Notes can apply to:

- Whole order
- Specific look

Notes are editable. If a note has already been used in a vendor brief, edits keep history. Vendor briefs preserve the data used at export time only when generated, but Phase 1 does not store exported brief snapshots.

### Style Direction Files

Use one upload system: `Style Direction Files`.

Categories:

- Moodboard
- Sketch
- Fabric Reference
- Colour Reference
- Other

Each file applies to:

- Whole order
- Specific look

Kuartz chooses whether a file requires client approval:

- `Requires client approval: Yes / No`

If no, it is an internal reference only.

### Approvals

Approval is file-level, not version-level.

Files support revisions:

```text
File
  Revision 1
  Revision 2
```

Rejected/revised files are replaced through new file revisions, not by creating a full new moodboard/sketch version.

Client comments attach to approval decisions on file revisions.

Approval statuses:

- Pending
- Approved
- With Revisions
- Rejected

If client selects `With Revisions` or `Rejected`, comment is required.

No formal `Style Direction complete` status in Phase 1. Completion is inferred from file approval statuses, pending approval lists, and revision queues.

### Magic Link Approval Batches

Kuartz can batch multiple files into one approval link.

A batch can include files from multiple looks. Client-facing approval page groups files by:

- Whole order
- Look name

Each file still receives its own decision.

Every resend creates a new approval request. Older pending approval links become inactive if replaced by a newer request.

Magic links:

- Are specific to approval/confirmation context
- Expire after completion or 7 days
- Do not allow client uploads
- Can be sent by email or copied manually so Kuartz can share them through WhatsApp.

## 8. Stage 3 - Measurements and Order Details

### Measurement Profile

Use a broad client measurement profile, not only 8 fixed fields.

Kuartz can fill what they have. Fields are not all required globally.

Kuartz can add more measurement fields if needed.

Measurement profile supports history:

- Changed field
- Previous value
- New value
- Date
- Updated by
- Optional note

### Measurement Requirements

Item type templates define required measurements.

Initial templates:

- Suit
- Agbada
- Shirt
- Trouser
- Cap
- Shoes

The app checks missing measurements per item type.

Vendor brief cannot be sent if required measurements are missing, unless Super Admin overrides with reason.

### Client Measurement Confirmation

Clients can confirm measurement profile via magic link.

Measurement confirmation is optional. It is available when Kuartz wants client confirmation, but it is not required before vendor brief export.

Client can:

- View read-only measurements
- Confirm
- Request correction with required comment

Client cannot upload files.

Measurement confirmation applies to the full measurement profile, not per look/item.

### Order Detail Confirmation

Kuartz can send full order details for client confirmation via magic link.

Client sees:

- Order title
- Looks
- Items
- Final agreed price
- Key notes

Client can:

- Confirm
- Request correction with required comment

Vendor assignment can happen before confirmations. Vendor brief export is blocked only if required measurements for the relevant item type are missing, unless Super Admin overrides.

## 9. Stage 4 - Vendor Assignment and Production

### Assignment Model

Vendors are assigned at item level.

Bulk assignment at look level is allowed for speed.

Each item has only one vendor in Phase 1.

Each vendor assignment has its own production deadline.

Vendor assignment can happen before all confirmations are complete. Vendor brief export is blocked only if required measurements for the relevant item type are missing, unless Super Admin overrides.

### Vendor Picker

Vendor selection should show:

- Vendor name
- Specialties/item types
- Overall rating
- Quality score
- Timeliness score
- Communication score
- Completed jobs count
- Open jobs count
- Last job date

No formal vendor capacity tracking in Phase 1.

Vendor must exist in the vendor directory before assignment, but assignment flow supports quick-create vendor from the picker.

Quick-create vendor minimum fields:

- Vendor name
- Phone (optional)
- Specialty (optional)

Vendor specialties use configurable dropdown tags:

- Super Admin manages specialty tags.
- Admin Assistant selects from existing tags.
- Tags can be archived.
- Vendors can have multiple specialties.

Default specialty examples:

- Suit
- Agbada
- Shirt
- Trouser
- Cap
- Shoes
- Accessories
- Embroidery

No vendor availability notes feature in Phase 1.

Vendor contact details appear in the assignment detail view/drawer, not in every production list row.

### Vendor Briefs

Vendor briefs are exported as PDFs only.

No vendor portal and no vendor magic link in Phase 1.

Flow:

1. Generate brief.
2. Review/edit.
3. Choose visible fields fresh each time.
4. Export PDF.
5. Send outside the app by WhatsApp/email.

Brief edits affect the brief preview/PDF only by default. If source data should change, the app can ask whether to update the source record.

Exported PDFs and brief snapshots are not stored in Phase 1.

Track export metadata only:

- Brief exported: yes/no
- Last exported at
- Exported by

No separate "mark brief as sent" action.

### Production Tracking

Production status is tracked only at item/vendor assignment level.

Production statuses use one configurable dropdown list shared by all production items.

Default status options:

- Not Started
- In Production
- Issue / Delay
- Ready for Fitting
- Completed

Rules:

- Super Admin manages the dropdown options.
- Admin Assistant only selects from the dropdown.
- Same list applies to all item/vendor assignments.
- Statuses can be archived, not hard-deleted.
- At least one status is marked as completed.
- Statuses have sort order.

Changing production status creates an automatic history entry:

- Item/vendor assignment
- Previous status
- New status
- Changed by
- Changed at
- Optional note

Deadline changes do not need formal history entries in Phase 1.

No manual priority field. Urgency is automatic from deadline:

- Overdue: red
- Due in 1-3 days: red/urgent
- Due in 4-7 days: amber
- Future: normal

No formal Challenge Log in Phase 1.

Use lightweight `Production Notes` on each item/vendor assignment:

- Note
- Created by
- Created at

Production notes are internal only and are not included in vendor brief PDFs.

No separate file uploads on item/vendor assignments in Phase 1. Production-related files should live in existing areas:

- Style Direction Files for references/sketches
- Vendor payment records for receipt uploads
- Measurements area for measurement sheets/photos

Primary production view should group:

```text
Client -> Order -> Look -> Item
```

Filters:

- Vendor
- Status
- Due date
- Overdue
- Client

No Kanban view in Phase 1.

Client payment position appears at order level, not every item row.

Item rows show compact vendor payment position, such as:

```text
Vendor: N80k paid / N70k owed
```

### Payment Gate

If order balance is greater than zero, the app blocks marking the order delivered/completed.

Super Admin can override this block with a required reason. Override is audited.

When amount/total due and amount paid are entered, balance is calculated automatically:

- Order balance = total invoiced - total paid
- Vendor balance = agreed vendor cost - amount paid

When an order is completed/delivered, the app creates or surfaces pending vendor rating prompts for vendors involved.

## 10. Payments and Invoices

### Client Payments

Client payments are tracked at order level through an invoice.

Invoices use manual line items.

Invoice fields:

- Client order
- Invoice number
- Issue date
- Due date
- Status: Draft / Sent / Part Paid / Paid / Void
- Line items
- Notes
- Payment instructions

Line item fields:

- Description
- Quantity
- Unit price
- Amount

One order has one invoice in Phase 1.

Multiple invoices per order are deferred unless Kuartz later needs staged invoices, add-on invoices, or separate accessory invoices.

Payments are recorded against the order invoice.

If entered payment numbers do not add up, the app should bring it to notice instead of silently accepting the mismatch.

Order balance is calculated automatically from invoice total minus amount paid.

Invoice PDFs are generated on demand from structured data and are not stored.

### Vendor Payments

Vendor payments are simple payment records per vendor assignment.

Fields:

- Agreed vendor cost
- Amount paid
- Balance owed
- Payment records
- Receipt uploads
- Payment date
- Payment note/reference

No vendor invoice system in Phase 1.

### FF Discount

Orders include a Friends & Family discount marker.

Fields:

- `FF?` Yes / No
- `Amount discounted (optional)`

Rules:

- `Amount discounted` is informational only.
- It does not auto-calculate final agreed price.
- Final agreed price remains the source of truth for invoices, payments, balances, and payment gate.
- Super Admin and Admin Assistant can set/edit FF fields.
- Optional input fields should visibly include `(optional)` beside the label.

## 11. Stage 5 - Accessory Sourcing

Accessory Sourcing is a separate module.

Structure:

```text
Order
  Looks
    Production items
  Accessory Sourcing
    Accessory items
```

Accessory can optionally link to:

- Whole order
- Specific look

Accessory delivery date follows the linked look due date. Accessories do not need separate individual delivery dates in Phase 1.

Accessory items do not use vendor brief or production workflow.

Accessory item types use a configurable dropdown.

Default types:

- Shoes
- Watches
- Cufflinks
- Shirts
- Pocket Squares
- Fragrances
- Eyewear
- Jewelry
- Other

Rules:

- Super Admin manages accessory types.
- Admin Assistant selects from dropdown.
- Other/custom is allowed.
- Types can be archived.

Accessory statuses use a configurable dropdown.

Default statuses:

- Not Started
- Sourcing
- Ordered
- Delivered

Rules:

- Super Admin manages status options.
- Admin Assistant selects from dropdown.
- Statuses can be archived.
- At least one status is marked as delivered/completed.

Stage 5 still needs further grilling from whole-order accessory behavior onward.

## 12. Fitting and Vendor Rating

These stages still need detailed grilling.

Known from original workflow:

- Fitting session logs notes internally and can be confirmed by client via magic link.
- Vendor rating is triggered after vendor work is completed/received.
- Vendor rating criteria: Quality, Timeliness, Communication, each out of 5.

## 13. Notifications and Dashboard

### Notifications

Channels:

- Email
- Dashboard notifications

SMS deferred.

Reminder triggers:

- 7 days before deadline
- 3 days before deadline
- 1 day before deadline
- Overdue alert

Applies to:

- Enquiry follow-up to-dos
- Vendor production deadlines
- Accessory reminders based on linked look due dates
- Fitting dates

### Dashboard

Dashboard should include:

- Number of active clients
- Upcoming events/look dates sorted by date where available
- Delayed projects/orders/items behind schedule
- Pending approvals
- Outstanding client balances
- Vendor payment summaries
- Event/look countdowns
- Enquiry follow-ups due/overdue

## 14. Tech Stack

Locked stack:

- Full-stack `Next.js`
- `TypeScript`
- `Tailwind CSS`
- `shadcn/ui`
- `lucide-react`
- `Supabase Free` for auth and Postgres database
- `Drizzle` for schema, migrations, and server-side database queries
- `Supabase client` for auth and safe RLS-backed client operations
- `Cloudflare R2 Free` for uploaded files
- `Vercel Free` for hosting, unless revisited
- `Resend` for transactional email
- `Vercel Cron + Next.js route handler` for scheduled notifications
- Server-side HTML-to-PDF generation

### File Storage

Supabase stores metadata. Cloudflare R2 stores actual uploaded files.

Files are accessed using signed URLs.

Images should be compressed/resized before upload to stretch free storage limits.

Generated vendor brief PDFs are not stored.

Generated invoice PDFs are not stored.

### PWA

The app will be desktop/mobile responsive and installable as a PWA.

Internet connection is required in Phase 1. No offline sync/editing.

## 15. Architecture Decisions

### Data Access

Use hybrid data access:

- Client-side Supabase SDK for safe reads/writes where RLS is sufficient.
- Next.js server actions/API routes for sensitive business logic.

Sensitive server-side operations include:

- Payment/balance validation
- Invoice generation
- Magic link generation
- Signed R2 upload/download URLs
- Role-protected overrides
- PDF generation
- Notification scheduling
- Deletes

### Auth

Staff auth:

- Email/password
- Password reset

Client magic links are separate one-off approval/confirmation tokens, not client accounts.

### Permissions

Permissions enforced in:

- Frontend UI
- Server checks
- Supabase RLS where appropriate

### Organization Model

Phase 1 UX is single-tenant for Kuartz.

Database should include `organization_id` in core tables for future reuse, but no organization switcher or multi-company settings in Phase 1.

### Audit Log

Keep lightweight audit log for important actions:

- Payment created/edited/deleted
- Super Admin override used
- Magic link approved/rejected
- Vendor brief exported
- Role changed
- Order converted/completed
- Invoice sent/voided
- File revision replaced

Fields:

- Actor
- Action
- Entity type
- Entity ID
- Timestamp
- Summary

### Testing

Focused automated tests from the start.

Priority:

- Payment/balance calculation
- Magic link expiry/completion/replacement
- Role permissions
- Measurement requirement checks
- Approval decision validation
- Notification due-date logic
- Vendor brief blockers

Suggested tools:

- `Vitest` for business logic/unit tests
- `Playwright` for critical end-to-end flows later

## 16. Build Order

Recommended implementation order:

1. Domain model and database schema
2. Auth and roles
3. Enquiries and conversion to Client/Order
4. Order / Look / Item structure
5. Style Direction files and approvals
6. Measurements and requirement checks
7. Vendor assignment and production tracking
8. Payments and invoices
9. Notifications and dashboard
10. Polish, PWA, PDFs

## 17. Open Decisions

These decisions are intentionally paused or still need grilling:

1. Hosting
   - Vercel Free is recommended, but Cloudflare Pages remains a possible alternative.

2. Stage 5 Accessory Sourcing details
   - Whole-order accessory behavior onward still needs grilling.

3. Stage 6 Fitting Session details

4. Stage 7 Vendor Rating details

## 18. Approved Phase 1 Foundation Decisions

Approved August 4, 2026:

1. A person may have multiple open Enquiries and a Client may have multiple simultaneous Active Orders. Phone/email and similar-name matches warn and require acknowledgement, but never auto-merge or block legitimate creation. Conversion may associate an Enquiry with an existing Client.
2. Core operational records are archived indefinitely and can be restored. Financial records, audit entries, converted Enquiries, Clients, Orders, and their private-file history are never hard-deleted in Phase 1. A Super Admin may permanently delete only an unconverted Enquiry after a 30-day recovery period.
   - Admin Assistants and Super Admins may archive and restore Enquiries and their lightweight follow-up records. Client, Order, production, and other major operational archives/restores are reserved for Super Admin.
   - Invoices, payments, and audit entries are immutable evidence: they are corrected through domain actions such as voiding or reversal, not archive/delete.
   - Archiving a parent hides its dependent records without rewriting each child’s archive history; restoring the parent restores their visibility.
   - Private attachments remain recoverable with their parent. Attachments belonging only to an eligible unconverted Enquiry are purged when that Enquiry is permanently deleted after the recovery period; the audit tombstone remains.
3. Operational lists use real-time subscriptions or polling for freshness. Writes use optimistic version checks; a conflict preserves submitted input and offers reload/reapply. Offline editing remains out of scope.
