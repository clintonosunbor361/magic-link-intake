# Kuartz CRM Build and Test Checklist

Last updated: August 22, 2026

Legend:

- `[x]` Implemented in current codebase
- `[~]` Partially implemented or needs UX alignment
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
- [~] Responsive behavior across all screens
- [ ] Final production hosting/env setup review

### Clients / Intake

- [x] Clients section
- [x] Add Client manually
- [x] External intake link generation
- [x] External intake form submission
- [x] Copyable intake links for WhatsApp
- [x] Client duplicate checking
- [x] Client list filtering: all / with orders / without orders
- [x] Archived client support
- [x] Client profile page
- [x] Client to-dos with note field
- [x] Client measurements accessible from profile
- [~] Remove/retire old Enquiries UI from navigation/code path if no longer needed
- [ ] Smooth final “client without order” UX review

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
- [x] Measurements tab edits the reusable Client measurement profile directly inside the Order workspace
- [x] Style Direction tab
- [~] Vendors tab; currently routes assignment work through Looks & Items and Vendor directory
- [~] Production tab; currently links to Production workspace and Item assignments
- [~] Accessories tab; currently summarizes outstanding accessories and links to module
- [~] Fittings tab; currently summarizes open fittings and links to module
- [~] Payments tab; currently summarizes invoice/balance and links to invoice page

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
- [~] Approved/rejected/revision status is tracked; final "approved version highlighted" UX should be reviewed
- [~] Currently appears inside long Order page, not a dedicated tab
- [ ] Final UX polish for Style Direction tab

### Measurements

- [x] Client measurement profile
- [x] Configurable measurement fields
- [x] Measurement history/versioning
- [x] Measurement side drawer on Client profile
- [x] Measurement confirmation magic link
- [x] Measurement requirement rules by item type
- [x] Vendor brief blocker for missing required measurements
- [x] Add/edit measurements directly from Order workspace
- [ ] UX for missing measurements inside Order workspace

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
- [~] Vendor tab inside Order workspace not built as tab
- [ ] Final vendor assignment UX review

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
- [~] Payments exist, but not yet organized as Order workspace tab
- [ ] Final finance UX review

### Accessories

- [x] Accessory module exists
- [x] Accessory item types
- [x] Configurable accessory types
- [x] Accessory statuses
- [x] Configurable accessory statuses
- [x] Accessories can link to order/look
- [x] Accessory delivery date follows linked Look date logic
- [x] Accessory item UX covers assigned staff, supplier, budget in minor units, purchase date, derived delivery date/look due date, status, and notes
- [~] Accessory workflow still needs final business grilling
- [~] Exists as separate page, not Order workspace tab yet

### Fittings

- [x] Fitting session module exists
- [x] Fitting notes
- [x] Client fitting confirmation link
- [x] Fitting reminders foundation
- [~] Fitting correction/adjustment notes exist; final vendor-sharing workflow for fitting corrections needs review
- [~] Fitting workflow still needs final grilling
- [~] Exists as separate page, not Order workspace tab yet

### Vendor Ratings

- [x] Vendor rating module foundation
- [x] Rating criteria: quality, timeliness, communication
- [x] Overall score logic
- [x] Rating prompts after completion foundation
- [~] Vendor rating UX still needs final review

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
- [~] SMS reminders are in the original workflow document but deferred from the current product architecture
- [x] Client to-dos show all open to-dos sorted by closest due date
- [ ] Final notification delivery test with Resend/live env

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

### Open Decisions Still Not Final

- [ ] Delete strategy: soft delete / hard delete / auto purge
- [ ] Real-time freshness strategy
- [ ] Multiple active orders per client warning/block behavior
- [ ] Final hosting choice if Vercel Free is reconsidered
- [ ] Final Stage 5 accessory details
- [ ] Final Stage 6 fitting details
- [ ] Final Stage 7 vendor rating details

## Test Checklist

### Authentication / Roles

- [x] Super Admin can sign in
- [x] Admin Assistant can sign in
- [ ] Password reset works locally and in production
- [ ] Super Admin-only settings are blocked for Admin Assistant
- [ ] Admin Assistant cannot perform restricted destructive actions
- [x] Sign out works
- [ ] Unauthenticated users are redirected correctly

### Clients / Intake

- [x] Generate intake link
- [x] Copy intake link
- [x] Expired intake link shows inactive page
- [x] External client can submit intake form
- [x] Submitted intake creates Client contact
- [x] Manual Add Client works
- [x] Duplicate phone/email warning appears
- [ ] Same-name clients can be distinguished by phone/email
- [ ] Client list filters by all / with orders / without orders
- [ ] Archived client filter works
- [ ] Client profile displays correct details
- [ ] Client to-do can be created
- [ ] Client to-do can be marked done
- [ ] Client to-do note saves correctly

### Orders / Looks / Items

- [ ] Create order from Client profile
- [ ] Create order from Orders section by selecting Client
- [ ] Final agreed price is required
- [ ] Order cannot be created without at least one Look
- [ ] Multiple Looks can be added before creating Order
- [ ] Order creation only asks for order basics and Look names
- [ ] FF discount amount appears only after FF discount is selected
- [ ] Look date and Look notes are not shown in first-entry order creation
- [ ] Removed Look does not submit
- [ ] Created Order lands in correct workspace/page
- [ ] Add Item after Order creation
- [ ] Edit Look
- [ ] Archive/restore Look
- [ ] Cannot archive the last active Look
- [ ] Add/edit/archive Item
- [ ] Item quantity saves and displays correctly
- [ ] Order details can be sent to client for confirmation
- [ ] Client can confirm order details
- [ ] Client can request correction on order details with required comment
- [ ] Order list shows correct Look count

### Order Workspace UX

- [ ] Tabs render correctly
- [ ] Overview tab is default landing tab
- [ ] Looks & Items tab contains only Looks/Items work
- [ ] Measurements tab can edit Client measurements
- [ ] Style Direction tab contains creative/reference work only
- [ ] Vendors tab handles assignment work
- [ ] Production tab handles status/deadline tracking
- [ ] Accessories tab handles accessory sourcing
- [ ] Fittings tab handles fitting sessions
- [ ] Payments tab handles invoice/payment work
- [ ] Tabs are usable on mobile

### Style Direction

- [ ] Add consultation note
- [ ] Source selection changes input fields if applicable
- [ ] Call/WhatsApp/sketch/colour reference sources can be captured as consultation inputs
- [ ] Upload moodboard/sketch/fabric/colour reference
- [ ] Attach file to whole order
- [ ] Attach file to specific Look
- [ ] Upload new revision
- [ ] Mark file as requiring approval
- [ ] Create approval batch
- [ ] Copy approval link
- [ ] Client can approve file
- [ ] Client must comment for rejected / with revisions
- [ ] Approved file/revision is visually clear to Kuartz
- [ ] Old approval link becomes inactive after resend
- [ ] Client cannot upload files

### Measurements

- [ ] Add measurements from Client profile
- [ ] Edit measurements from Client profile
- [ ] Measurement history records previous/new value
- [x] Add/edit measurements from Order workspace
- [x] Order workspace edits save to Client profile
- [ ] Add custom measurement field
- [ ] Configure measurement requirements by item type
- [ ] Missing required measurements are detected per item
- [ ] Vendor brief export is blocked when required measurements are missing
- [ ] Super Admin override works with reason
- [ ] Client measurement confirmation link works
- [ ] Client cannot upload measurement files

### Vendor Assignment / Production

- [ ] Create Vendor
- [ ] Quick-create Vendor during assignment
- [ ] Assign vendor to one Item
- [ ] Bulk assign vendor to Look
- [ ] Vendor assignment deadline is required/works
- [ ] Production status can be changed
- [ ] Status history records change
- [ ] Deadline urgency colors/states work
- [ ] Production filters work
- [ ] Production view groups by Client -> Order -> Look -> Item
- [ ] Production note can be added
- [ ] Vendor brief preview generates
- [ ] Vendor brief is prefilled from earlier intake/order/style/measurement data
- [ ] Kuartz can edit vendor brief before exporting
- [ ] Visible fields can be chosen before export
- [ ] Vendor brief PDF exports
- [ ] Export metadata updates

### Payments / Invoices

- [ ] Create invoice with manual line items
- [ ] Invoice total calculates correctly
- [ ] Mark invoice sent
- [ ] Record client payment
- [ ] Order balance calculates correctly
- [ ] Overpayment/mismatch warning appears
- [ ] Vendor agreed cost can be entered
- [ ] Vendor payment can be recorded
- [ ] Vendor balance calculates correctly
- [ ] Receipt upload works
- [ ] Order completion blocked when client balance remains
- [ ] Super Admin override completion block works
- [ ] Override is audited
- [ ] Invoice PDF exports

### Accessories

- [ ] Add accessory item
- [ ] Link accessory to whole order
- [ ] Link accessory to specific Look
- [ ] Accessory delivery date follows Look date
- [x] Assigned staff can be selected for accessory item
- [x] Supplier can be entered for accessory item
- [x] Budget can be entered for accessory item
- [x] Purchase date can be entered for accessory item
- [ ] Accessory status changes
- [ ] Custom accessory type works
- [ ] Archived accessory types/statuses no longer appear for new records
- [ ] Accessory reminders are generated correctly

### Fittings

- [ ] Create fitting session
- [ ] Add fitting notes
- [ ] Add correction/adjustment notes from fitting
- [ ] Link fitting to Look if needed
- [ ] Send fitting confirmation link
- [ ] Client confirms fitting
- [ ] Client requests correction/comment if applicable
- [ ] Fitting corrections can be shared/exported for vendor action
- [ ] Fitting reminders trigger correctly

### Vendor Ratings

- [ ] Completion surfaces vendor rating prompt
- [ ] Rate Quality out of 5
- [ ] Rate Timeliness out of 5
- [ ] Rate Communication out of 5
- [ ] Overall score calculates correctly
- [ ] Rating history appears on Vendor
- [ ] Vendor picker shows useful rating context

### Dashboard / Notifications

- [ ] Dashboard active client count is correct
- [ ] Upcoming look dates sort correctly
- [ ] Delayed work appears correctly
- [ ] Pending measurement confirmations appear correctly
- [ ] Pending moodboard approvals appear correctly
- [ ] Pending sketch approvals appear correctly
- [x] Outstanding balances are correct
- [x] Vendor payment summaries are correct
- [x] Open client to-dos show, closest due first
- [ ] Dashboard notification created for due reminders
- [ ] Email notification sends through Resend
- [ ] Overdue alerts fire after deadline passes
- [ ] Cron route is protected and works

### Responsive / UX

- [ ] Sidebar does not cover content on tablet/desktop
- [ ] Mobile nav opens/closes correctly
- [ ] Clients list is readable on mobile
- [ ] Orders list is readable on mobile
- [ ] Tables do not create page-level horizontal overflow
- [ ] Forms stack cleanly on mobile
- [ ] Buttons do not overflow text
- [ ] Order creation flow feels lightweight
- [ ] Empty states are clear
- [ ] Loading/error states are clear

### Security / Data Protection

- [ ] RLS policies exist for core tables
- [ ] Staff can only access their organization data
- [ ] Magic links use token hashes, not raw stored tokens
- [ ] Magic links expire
- [ ] Old magic links become inactive when superseded
- [ ] Signed file URLs expire
- [ ] Client-facing pages expose only intended fields
- [ ] Admin-only actions validate role on server
- [ ] Audit log records sensitive actions

### Automated Checks

- [ ] `npm run typecheck`
- [ ] Core unit tests
- [ ] Database/RLS tests
- [ ] Order service tests
- [ ] Measurement tests
- [ ] Payment/balance tests
- [ ] Magic link tests
- [ ] Notification tests
- [ ] Critical Playwright flows
- [ ] Production build test

## Current Main Gap

The backend/domain is much further along than the UX. The biggest UI build remaining is the tabbed Order workspace and moving the existing order sections into those tabs cleanly.
