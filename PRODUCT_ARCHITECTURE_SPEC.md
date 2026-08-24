# Kuartz Fashion CRM - Product and Architecture Spec

Last updated: August 22, 2026

## 1. Product Summary

Kuartz Fashion CRM is an internal operations app for managing fashion styling work after a potential client enters the system. Kuartz sits between clients and vendors; vendors produce the items, while Kuartz manages styling, coordination, approvals, payments, deadlines, and delivery.

Phase 1 focuses on a lightweight client/contact directory and a structured active-order workflow.

## 2. Core Journey

1. A person enters the system through external intake link or internal staff entry.
2. They become a `Client` contact immediately, even if they do not yet have an order.
3. Kuartz follows up outside the app through WhatsApp, calls, or in-person conversation.
4. Client to-dos/reminders can be tracked lightly in the app.
5. Once price is agreed, Kuartz creates an `Active Order` under that Client.
6. The full workflow starts from the Active Order: style direction, measurements, looks/items, vendor assignment, production, accessories, fitting, payments, and vendor rating.

## 3. Roles and Users

There are two roles:

- `Super Admin`: full access, including settings, team management, payment edits/deletes, overrides, and major deletes.
- `Admin Assistant`: can manage operational records, upload files, send approval links, update statuses, add notes, and create records. Cannot perform sensitive/destructive actions reserved for Super Admin.

The app may have more than two users. Users are assigned one of the two roles.

## 4. Clients and Intake

### Client Contact Concept

A `Client` is anyone captured in the system, whether they already have confirmed work or are still only a contact. This keeps the workflow lightweight: Kuartz does not need to manage a separate enquiry pipeline before adding work.

Clients can be filtered by order state:

- All clients
- Clients with orders
- Clients without orders
- Archived clients

Clients without orders should stay lightweight. They do not need:

- Style direction files
- Moodboards/sketches
- Measurements
- Vendor assignments
- Payments
- Production workflow
- Accessories
- Fittings

### External Intake Links

Kuartz can generate a copyable intake link and share it with a potential client, including through WhatsApp. The submitted external form creates a Client contact.

Generated intake links expire and should not require a client account.

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

### Internal Client Entry

Internal staff entry also creates a Client contact.

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

Lead source is selected from a configurable dropdown. Super Admin manages the available lead source options in Settings; Admin Assistant selects from the active list.

### Client To-Dos

Use to-dos for lightweight follow-up. Separate follow-up notes are removed in Phase 1 to reduce friction.

To-do fields:

- Task title
- Due date
- Assigned to
- Status: `Open` / `Done`
- Optional note

## 5. Client and Order Model

### Order Creation

An Active Order is created under an existing Client once price and scope are agreed.

Final agreed price is required before creating an Active Order. A Client can exist without an Order.

The preferred entry path is:

```text
Client profile -> New Order -> core order details + look names -> Order workspace
```

The standalone `Orders -> Add Order` flow is still available, but it should be secondary. It requires choosing the Client first.

### Active Order Required Fields

- Client
- Order title
- Event type
- Final agreed price
- Primary owner
- At least one Look

The order creation form supports adding multiple Looks before creating the Order.

Items are not required during order creation. They should be added later inside the Order workspace to keep first entry lightweight.

### Order Workspace UX

After creating an Order, Kuartz lands in a tabbed Order workspace.

Recommended tabs:

- Overview
- Looks & Items
- Style Direction
- Measurements
- Vendors
- Production
- Accessories
- Fittings
- Payments

The `Overview` tab should be the landing tab. It should summarize the order and show practical next actions, such as:

- Add items
- Add measurements
- Upload style direction files
- Assign vendors

The Order workspace should avoid forcing Kuartz to complete the entire setup at once. The goal is to create the order quickly, then fill operational details as the work becomes clearer.

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
- Notes (optional)
- Items

### Item Fields

- Item type/name
- Quantity
- Assigned vendor later
- Production status later

Items are created after the Order exists, usually from the `Looks & Items` tab. Each Look can have one or more Items.

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

Client search/filter screens should make it easy to distinguish same-name clients by showing phone number, email, and latest/active order context.

## 7. Stage 2 - Style Direction

Style Direction happens inside an Active Order, not on a Client contact without an Order.

In the Order workspace, Style Direction should have its own tab.

The Style Direction tab includes:

- Consultation notes
- Style direction files
- File revisions
- Approval status
- Magic approval links

The Style Direction tab should not include:

- Measurements
- Items
- Vendor assignment
- Production status
- Payments
- Accessories

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

Measurements belong to the Client profile, not to an individual Order.

Kuartz can add or update measurements from:

- Client profile
- Order workspace `Measurements` tab

When measurements are edited from an Order workspace, the values still save back to the Client measurement profile. The Order workspace is only another access point, so Kuartz does not need to leave an active Order to update measurements.

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

Order detail confirmation should be accessible from the Order workspace, likely from the `Overview` tab or a client confirmation action area.

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

- Client to-dos
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
- Open client to-dos, sorted by closest due date first

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

Responsive UX rules:

- Primary list pages should use card/list layouts on small and medium screens.
- Wide tables should only appear when there is enough viewport width.
- The app sidebar must not cover main content on tablet or desktop widths.
- Forms should stack cleanly on mobile and avoid horizontal page overflow.

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
3. Clients, intake links, and client to-dos
4. Lightweight order creation with multiple Looks
5. Tabbed Order workspace shell
6. Looks & Items tab
7. Client measurement profile plus Order workspace measurement access
8. Style Direction tab with files, revisions, and approvals
9. Vendor assignment and production tracking
10. Payments and invoices
11. Accessories and fittings
12. Notifications and dashboard
13. Polish, PWA, PDFs

## 17. Open Decisions

These decisions are intentionally paused or still need grilling:

1. Delete strategy
   - Soft delete vs hard delete
   - Auto-purge after 30 days or not
   - Which records are recoverable

2. Real-time / multi-user freshness
   - No full real-time locked yet
   - Need to decide between manual refresh, auto-refresh, conflict warnings, or real-time subscriptions

3. Multiple active orders per client
   - Whether a client can have multiple active orders simultaneously
   - Whether app should warn or block when creating another active order

4. Hosting
   - Vercel Free is recommended, but Cloudflare Pages remains a possible alternative.

5. Stage 5 Accessory Sourcing details
   - Whole-order accessory behavior onward still needs grilling.

6. Stage 6 Fitting Session details

7. Stage 7 Vendor Rating details
