# Kuartz CRM Build and Test Checklist

Last updated: September 10, 2026

Release verification is recorded in [docs/release-verification.md](docs/release-verification.md).
Notification delivery follows the agreed single-overdue-email policy with bounded failure retries;
the authorized provider test was delivered. Production migration, deployment, R2, capability,
and scheduled invocation are verified; remaining live gaps are stated precisely below.

Legend:

- `[x]` Implemented in current codebase
- `[~]` Partially complete or has a precisely documented live dependency
- `[ ]` Not built yet or not confirmed

## Build Checklist

### Foundation / Architecture

- [x] Next.js app structure
- [x] TypeScript setup
- [x] Tailwind UI styling
- [x] App shell and sidebar navigation
- [x] Supabase auth integration
- [x] Drizzle schema and migrations
- [x] Role model: Super Admin / Admin Assistant
- [x] Server actions and repository/service pattern
- [x] Audit log foundation
- [x] PWA manifest/offline shell
- [x] Responsive behavior across representative Client, Order, Production, and finance screens
- [~] Production is deployed on Vercel with migrations, R2, capability isolation, and deployed PDF exports verified; password recovery and a verified Resend sender domain remain below

### Clients / Intake

- [x] Clients section
- [x] Add Client manually
- [x] External intake link generation
- [x] Generated intake links are tracked on the Clients page
- [x] External intake form submission
- [x] Copyable intake links for WhatsApp
- [x] Client duplicate checking
- [x] Client list filtering: all / with orders / without orders
- [x] Archived client support
- [x] Client profile page
- [x] Client to-dos with note field
- [x] Client measurements accessible from profile
- [x] Retired Enquiries UI and navigation while preserving migrated Client data
- [x] Lightweight “client without order” UX with a clear New Order path

### Orders

- [x] Add Order from Orders section
- [x] Add Order from Client profile
- [x] Required final agreed price
- [x] FF discount marker
- [x] Optional amount discounted
- [x] Multiple Looks during order creation
- [x] Lightweight first-entry form: order basics plus Look names only
- [x] FF discount amount is only shown when FF discount is selected
- [x] Removed from first-entry form: Look date and Look notes; these are handled after order creation
- [x] Items can be added after order creation
- [x] Order detail page
- [x] Orders page status filters: all / active / completed / delayed
- [x] Overview Pipeline card uses total orders with active/completed/delayed breakdown
- [x] Pipeline rows link to the matching filtered Orders list
- [x] Looks CRUD
- [x] Items CRUD
- [x] Item quantity support
- [x] Order detail confirmation magic link foundation
- [x] Order creation UX refined to feel lighter
- [x] Tabbed Order workspace
- [x] Mobile Order workspace selector replaces crowded tabs on small screens
- [x] Overview tab with next actions
- [x] Looks & Items tab
- [x] Looks are displayed as compact workspace cards instead of always-open edit forms
- [x] Measurements tab inside Order workspace can view and edit Client profile measurements
- [x] Style Direction tab
- [x] Vendors tab with individual and Look-level assignment workflows
- [x] Production tab with status controls and assignment detail links
- [x] Accessories tab embeds the shared sourcing workspace
- [x] Fittings tab embeds the shared appointment workspace
- [x] Payments tab embeds the shared invoice and payment workspace

### Style Direction

- [x] Consultation note infrastructure
- [x] Configurable consultation note sources
- [x] Source support for calls, WhatsApp, sketches, colour references, and other consultation inputs
- [x] Style Direction file upload system
- [x] File categories
- [x] File revisions
- [x] File-level approvals
- [x] Approval batches
- [x] Magic approval links
- [x] Approval decision page
- [x] Approved/rejected/revision status and current approved revision are visually identified
- [x] Dedicated Style Direction Order workspace tab
- [x] Style Direction tab responsive and workflow UX review

### Measurements

- [x] Client measurement profile
- [x] Configurable measurement fields
- [x] Measurement history/versioning
- [x] Measurement side drawer on Client profile
- [x] Measurement confirmation magic link
- [x] Measurement requirement rules by item type
- [x] Vendor brief blocker for missing required measurements
- [x] Add/edit measurements directly from Order workspace
- [x] Missing measurements shown per Item inside Order workspace

### Vendors / Production

- [x] Vendor directory
- [x] Vendor specialties
- [x] Vendor rating scores foundation
- [x] Item-level vendor assignment
- [x] Bulk assignment at Look level
- [x] One vendor per item
- [x] Vendor production deadline
- [x] Configurable production statuses
- [x] Status history
- [x] Production workspace grouped by Client -> Order -> Look -> Item
- [x] Production filters
- [x] Urgency from deadline
- [x] Production notes
- [x] Vendor brief PDF generation
- [x] Vendor brief auto-prefill from earlier order/style/measurement data
- [x] Vendor brief field visibility selection
- [x] Vendor brief review/edit before PDF export
- [x] Vendor brief export metadata
- [x] Vendor tab inside Order workspace
- [x] Vendor assignment UX review

### Payments / Invoices

- [x] One invoice per order
- [x] Manual invoice line items
- [x] Invoice statuses
- [x] Invoice PDF generation
- [x] Client payment records
- [x] Vendor payment records
- [x] Receipt upload support
- [x] Automatic balance calculations
- [x] Payment gate blocking order completion
- [x] Super Admin override for payment gate
- [x] Payments organized as an Order workspace tab
- [x] Finance UX review

### Accessories

- [x] Accessory module exists
- [x] Accessory item types
- [x] Configurable accessory types
- [x] Accessory statuses
- [x] Configurable accessory statuses
- [x] Accessories can link to order/look
- [x] Accessory delivery date follows linked Look date logic
- [x] Accessory UX covers assigned staff, supplier, minor-unit budget, purchase date, linked Look due date, and status
- [x] Accessory workflow matches the confirmed Phase 1 release decisions
- [x] Accessories workflow is embedded in the Order workspace tab and remains available on its detail route

### Fittings

- [x] Fitting session module exists
- [x] Fitting notes
- [x] Client fitting confirmation link
- [x] Fitting reminders foundation
- [x] Fitting correction/adjustment notes remain internal; vendor sharing/export is deferred from Phase 1
- [x] Fitting workflow matches the confirmed appointment-confirmation scope
- [x] Fittings workflow is embedded in the Order workspace tab and remains available on its detail route

### Vendor Ratings

- [x] Vendor rating module foundation
- [x] Rating criteria: quality, timeliness, communication
- [x] Overall score logic
- [x] Rating prompts after completion foundation
- [x] Vendor rating UX supports one rating per Item assignment and useful Vendor context

### Notifications / Dashboard

- [x] Dashboard page
- [x] Active clients count
- [x] Upcoming look dates
- [x] Delayed production items
- [x] Pending client responses
- [x] Outstanding balances summary
- [x] Vendor payment summaries
- [x] Notification records
- [x] Cron route for notifications
- [x] Email/dashboard notification architecture
- [x] SMS reminders explicitly deferred from Phase 1
- [x] Client to-dos show all open to-dos sorted by closest due date
- [x] Authorized Resend provider test delivered successfully
- [~] Deployed cron authentication, dry run, and an actual scheduled invocation are verified; the scheduled run persisted two reminders whose Resend deliveries failed because no sender domain is registered

### Settings

- [x] Team management
- [x] Item types
- [x] Measurement fields
- [x] Measurement requirements
- [x] Consultation note sources
- [x] Vendor specialties
- [x] Production statuses
- [x] Accessory types
- [x] Accessory statuses

### Confirmed Release Decisions / Deferred Scope

- [x] Operational records archive/restore; permanent deletion and automatic purging are unavailable
- [x] Refresh after saves and page return, with manual refresh; live subscriptions are deferred
- [x] Multiple active Orders are allowed with a warning showing existing active Orders
- [x] Accessory, Fitting, and Vendor Rating behavior is limited to the confirmed Phase 1 scope
- [x] Vercel remains the Phase 1 host; alternative hosting is deferred

## Test Checklist

### Authentication / Roles

- [x] Super Admin can sign in
- [x] Admin Assistant can sign in
- [~] Password reset implementation and local route behavior are covered; complete production recovery remains to be observed with the dedicated test account
- [x] Super Admin-only settings are blocked for Admin Assistant
- [x] Admin Assistant cannot perform restricted destructive actions
- [x] Sign out works
- [x] Unauthenticated users are redirected correctly

### Clients / Intake

- [x] Generate intake link
- [x] Copy intake link
- [x] Generated intake link history shows active, used, and expired states correctly
- [x] Expired intake link shows inactive page
- [x] External client can submit intake form
- [x] Submitted intake creates Client contact
- [x] Manual Add Client works
- [x] Duplicate phone/email warning appears
- [x] Same-name clients can be distinguished by phone/email and Order context
- [x] Client list filters by all / with orders / without orders
- [x] Archived client filter works
- [x] Client profile displays correct details
- [x] Client to-do can be created
- [x] Client to-do can be marked done
- [x] Client to-do note saves correctly

### Orders / Looks / Items

- [x] Create order from Client profile
- [x] Create order from Orders section by selecting Client
- [x] Final agreed price is required
- [x] Order cannot be created without at least one Look
- [x] Multiple Looks can be added before creating Order
- [x] Order creation only asks for order basics and Look names
- [x] FF discount amount appears only after FF discount is selected
- [x] Look date and Look notes are not shown in first-entry order creation
- [x] Removed Look does not submit
- [x] Created Order lands in correct workspace/page
- [x] Add Item after Order creation
- [x] Edit Look
- [x] Archive/restore Look
- [x] Cannot archive the last active Look
- [x] Add/edit/archive Item
- [x] Item quantity saves and displays correctly
- [x] Order details can be sent to client for confirmation
- [x] Client can confirm order details
- [x] Client can request correction on order details with required comment
- [x] Order list shows correct Look count

### Order Workspace UX

- [x] Tabs render correctly
- [x] Overview tab is default landing tab
- [x] Looks & Items tab contains only Looks/Items work
- [x] Measurements tab can edit Client measurements
- [x] Style Direction tab contains creative/reference work only
- [x] Vendors tab handles assignment work
- [x] Production tab handles status/deadline tracking
- [x] Accessories tab handles accessory sourcing
- [x] Fittings tab handles fitting sessions
- [x] Payments tab handles invoice/payment work
- [x] Tabs are usable on mobile

### Style Direction

- [x] Add consultation note
- [x] Source selection changes source-specific input fields while preserving entered details
- [x] Call/WhatsApp/sketch/colour reference sources can be captured as consultation inputs
- [x] Upload moodboard/sketch/fabric/colour reference
- [x] Attach file to whole order
- [x] Attach file to specific Look
- [x] Upload new revision
- [x] Mark file as requiring approval
- [x] Create approval batch
- [x] Copy approval link
- [x] Client can approve file
- [x] Client must comment for rejected / with revisions
- [x] Approved file/revision is visually clear to Kuartz
- [x] Old approval link becomes inactive after resend
- [x] Client cannot upload files

### Measurements

- [x] Add measurements from Client profile
- [x] Edit measurements from Client profile
- [x] Measurement history records previous/new value
- [x] Add/edit measurements from Order workspace
- [x] Order workspace edits save to Client profile
- [x] Add custom measurement field
- [x] Configure measurement requirements by item type
- [x] Missing required measurements are detected per item
- [x] Vendor brief export is blocked when required measurements are missing
- [x] Super Admin override works with reason
- [x] Client measurement confirmation link works
- [x] Client cannot upload measurement files

### Vendor Assignment / Production

- [x] Create Vendor
- [x] Quick-create Vendor during assignment
- [x] Assign vendor to one Item
- [x] Bulk assign vendor to Look
- [x] Vendor assignment deadline is required/works
- [x] Production status can be changed
- [x] Status history records change
- [x] Deadline urgency colors/states work
- [x] Production filters work
- [x] Production view groups by Client -> Order -> Look -> Item
- [x] Production note can be added
- [x] Vendor brief preview generates
- [x] Vendor brief is prefilled from earlier intake/order/style/measurement data
- [x] Kuartz can edit vendor brief before exporting
- [x] Visible fields can be chosen before export
- [x] Vendor brief PDF exports locally and from the deployed application
- [x] Export metadata updates

### Payments / Invoices

- [x] Create invoice with manual line items
- [x] Invoice total calculates correctly
- [x] Mark invoice sent
- [x] Record client payment
- [x] Order balance calculates correctly
- [x] Overpayment/mismatch warning appears
- [x] Vendor agreed cost can be entered
- [x] Vendor payment can be recorded
- [x] Vendor balance calculates correctly
- [x] Receipt upload works in the configured storage adapter
- [x] Order completion blocked when client balance remains
- [x] Super Admin override completion block works
- [x] Override is audited
- [x] Invoice PDF exports locally and from the deployed application for the Admin Assistant release identity; anonymous access is rejected

### Accessories

- [x] Add accessory item
- [x] Link accessory to whole order
- [x] Link accessory to specific Look
- [x] Accessory delivery date follows linked Look date; whole-Order accessories have no inferred date
- [x] Assigned staff can be selected for accessory item
- [x] Supplier can be entered for accessory item
- [x] Budget can be entered for accessory item
- [x] Purchase date can be entered for accessory item
- [x] Accessory status changes
- [x] Custom accessory type works
- [x] Archived accessory types/statuses no longer appear for new records
- [x] Accessory reminders are generated correctly

### Fittings

- [x] Create fitting session
- [x] Add fitting notes
- [x] Add correction/adjustment notes from fitting
- [x] Link fitting to Look if needed
- [x] Send fitting appointment confirmation link
- [x] Client confirms fitting appointment details
- [x] Client requests correction/comment on appointment details when applicable
- [x] Fitting corrections remain internal; vendor sharing/export is deferred from Phase 1
- [x] Fitting reminders trigger correctly

### Vendor Ratings

- [x] Completion surfaces one vendor rating prompt per Item assignment without duplicates
- [x] Rate Quality out of 5
- [x] Rate Timeliness out of 5
- [x] Rate Communication out of 5
- [x] Overall score calculates correctly
- [x] Rating history appears on Vendor with job context
- [x] Vendor picker shows useful rating and workload context

### Dashboard / Notifications

- [x] Dashboard active client count is correct
- [x] Upcoming look dates sort correctly
- [x] Delayed work appears correctly
- [x] Pending measurement confirmations appear correctly
- [x] Pending moodboard approvals appear correctly
- [x] Pending sketch approvals appear correctly
- [x] Outstanding balances are correct
- [x] Vendor payment summaries are correct
- [x] Open client to-dos show, closest due first
- [x] Dashboard notification created for due reminders
- [x] Email notification sends through Resend (authorized provider delivery recorded)
- [x] Overdue alerts fire once after deadline passes with bounded failure retries
- [x] Cron route authentication and processing behavior pass automated coverage
- [~] Production cron rejects unauthorized requests, its authenticated dry run passes, and a scheduled invocation returned 200; two persisted reminder deliveries still need a verified Resend sender domain and successful retry

### Responsive / UX

- [x] Sidebar does not cover content on tablet/desktop
- [x] Mobile nav opens/closes correctly
- [x] Clients list is readable on mobile
- [x] Orders list is readable on mobile
- [x] Tables do not create page-level horizontal overflow
- [x] Forms stack cleanly on mobile
- [x] Buttons do not overflow text
- [x] Order creation flow feels lightweight
- [x] Empty states are clear
- [x] Loading/error states are clear

### Security / Data Protection

- [x] RLS policies exist for core tables
- [x] Staff can only access their organization data
- [x] Magic links use token hashes, not raw stored tokens
- [x] Magic links expire after seven days or completion; completed links no longer reveal their prior context
- [x] Old magic links become inactive when superseded
- [x] Production R2 objects are private and signed file URLs expire (live verification recorded)
- [x] Client-facing pages expose only intended fields in automated and labelled production capability journeys
- [x] Admin-only actions validate role on server
- [x] Audit log records sensitive actions

### Automated Checks

- [x] `npm run typecheck` — passed in the final September 10, 2026 release gate
- [x] Core unit tests — current release run: 650 tests across 76 files passed
- [x] Database/RLS tests — seven local database assertions passed, including migration 0036
- [x] Order service tests
- [x] Measurement tests
- [x] Payment/balance tests
- [x] Magic link tests
- [x] Notification tests
- [x] Critical Playwright flows — eight recorded release journeys passed
- [x] Production build test — current release build passed

## Remaining Release Verification

The Phase 1 application and tabbed Order workspace are implemented and the final local release gate passes. Production deployment, migration 0036, R2 privacy/expiry, capability isolation, deployed Invoice and Vendor Brief PDFs, protected cron behavior, and an actual scheduled invocation are verified. Remaining live checks are completing password recovery with the dedicated test account and registering/verifying a Resend sender domain so the two retry-safe scheduled reminder failures can be delivered successfully.
