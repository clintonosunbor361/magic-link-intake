import Link from "next/link";
import { notFound } from "next/navigation";
import {
  archiveItemAction,
  archiveLookAction,
  archiveOrderAction,
  createItemAction,
  createLookAction,
  restoreItemAction,
  restoreLookAction,
  restoreOrderAction,
  updateItemAction,
  updateLookAction,
  updateOrderAction,
} from "@/app/actions/orders";
import {
  archiveConsultationNoteAction,
  createConsultationNoteAction,
  restoreConsultationNoteAction,
  updateConsultationNoteAction,
} from "@/app/actions/consultation-notes";
import {
  archiveStyleDirectionFileAction,
  restoreStyleDirectionFileAction,
  reviseStyleDirectionFileAction,
  uploadStyleDirectionFileAction,
} from "@/app/actions/style-direction-files";
import {
  archiveAccessoryItemAction,
  createAccessoryItemAction,
  restoreAccessoryItemAction,
  updateAccessoryItemAction,
} from "@/app/actions/accessories";
import {
  addFittingNoteAction,
  archiveFittingAction,
  changeFittingStatusAction,
  issueFittingConfirmationAction,
  rescheduleFittingAction,
  restoreFittingAction,
  scheduleFittingAction,
  updateFittingSummaryAction,
} from "@/app/actions/fittings";
import { createInvoiceAction, updateInvoiceAction, voidInvoiceAction } from "@/app/actions/invoices";
import { editClientPaymentAction, recordClientPaymentAction, voidClientPaymentAction } from "@/app/actions/payments";
import { issueOrderConfirmationAction } from "@/app/actions/client-confirmations";
import { completeOrderAction } from "@/app/actions/order-completion";
import { requireStaffSession } from "@/lib/auth/session";
import { canManageFinance, canManageMeasurementFieldDefinitions, canOverrideCompletionGate } from "@/lib/domain/access-control";
import { mayArchive, mayRestore } from "@/lib/domain/record-lifecycle";
import { listAccessoryItemsForOrder, listOutstandingAccessories } from "@/lib/accessories/repository";
import { listAccessoryStatuses } from "@/lib/accessory-statuses/repository";
import { listAccessoryTypes } from "@/lib/accessory-types/repository";
import {
  FITTING_SESSION_STATUSES,
  FITTING_STATUS_LABELS,
  isTerminalFittingStatus,
} from "@/lib/fittings/fitting";
import {
  listFittingHistory,
  listFittingNotes,
  listFittingSessionsForOrder,
  listOpenFittingSessions,
} from "@/lib/fittings/repository";
import { blocksOrderCompletion, computeOrderBalance } from "@/lib/finance/balances";
import {
  computeLineAmountMinor,
  deriveInvoiceStatus,
  detectPaymentMismatches,
  INVOICE_STATUS_LABELS,
} from "@/lib/finance/invoice";
import { getInvoiceForOrder } from "@/lib/finance/repository";
import { getOrderWithLooksAndItems } from "@/lib/orders/repository";
import { getMissingMeasurementsForOrder } from "@/lib/item-type-measurement-requirements/repository";
import { listItemTypes } from "@/lib/item-types/repository";
import { listConsultationNoteSources } from "@/lib/consultation-note-sources/repository";
import { listConsultationNotesForOrder } from "@/lib/consultation-notes/repository";
import {
  listStyleDirectionFileRevisionsForFiles,
  listStyleDirectionFilesForOrder,
} from "@/lib/style-direction-files/repository";
import { formatStyleDirectionLabel, STYLE_DIRECTION_FILE_CATEGORIES } from "@/lib/style-direction-files/file-service";
import { getSignedPrivateViewUrl } from "@/lib/storage/r2";
import {
  listApprovalBatchesForOrder,
  listPendingApprovalFiles,
  listRevisionQueueFiles,
} from "@/lib/style-direction-approvals/repository";
import { listConfirmationsForSubject } from "@/lib/client-confirmations/repository";
import { formatMinorUnits } from "@/lib/forms/money";
import { businessToday, formatBusinessDate } from "@/lib/domain/business-date";
import { getOrganizationTimezone } from "@/lib/organizations/repository";
import { createMeasurementProfileRepository, listMeasurementProfileSnapshot } from "@/lib/measurement-profiles/repository";
import { getOrCreateMeasurementProfile } from "@/lib/measurement-profiles/service";
import { getLiveAssignmentDetailForItem } from "@/lib/production/assignment-repository";
import { listVendorsAwaitingRating } from "@/lib/vendors/rating-repository";
import { listVendorsWithStats } from "@/lib/vendors/repository";
import { listStaffMembers } from "@/lib/team/repository";
import { InvoiceLineItemsFields } from "@/components/finance/invoice-line-items-fields";
import { SendInvoiceButton } from "@/components/finance/send-invoice-button";
import { MeasurementDrawer } from "@/components/clients/measurement-drawer";
import { ItemAssignmentDrawer, LookBulkAssignForm } from "@/components/production/assignment-drawer";
import { OrderWorkspaceNav } from "@/components/orders/order-workspace-nav";
import { LookWorkspaceAccordion } from "@/components/orders/look-workspace-accordion";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { EmptyState } from "@/components/ui/empty-state";
import { FormDisclosure } from "@/components/ui/form-disclosure";
import { FormModal } from "@/components/ui/form-modal";
import { MoneyInput } from "@/components/ui/money-input";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

const dateFormatter = new Intl.DateTimeFormat("en-NG", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Lagos",
});
const textareaClass =
  "min-h-[3.5rem] w-full rounded-[0.8rem] border border-kuartz-control bg-white/70 px-3.5 py-3 text-sm text-kuartz-ink outline-none focus:border-[#88925f] focus:bg-white focus:ring-4 focus:ring-kuartz-lime/20";
const ORDER_WORKSPACE_TABS = [
  { id: "overview", label: "Overview" },
  { id: "looks", label: "Looks & Items" },
  { id: "style", label: "Style Direction" },
  { id: "measurements", label: "Measurements" },
  { id: "vendors", label: "Vendors" },
  { id: "production", label: "Production" },
  { id: "accessories", label: "Accessories" },
  { id: "fittings", label: "Fittings" },
  { id: "payments", label: "Payments" },
] as const;

type OrderWorkspaceTab = (typeof ORDER_WORKSPACE_TABS)[number]["id"];

// See app/actions/consultation-notes.ts's readOccurredAt for why this round-trips as UTC digits.
function toDateTimeLocalValue(date: Date | null): string {
  if (!date) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}T${value.hour}:${value.minute}`;
}

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; notice?: string; tab?: string; modal?: string }>;
}) {
  const session = await requireStaffSession();
  const { id } = await params;
  const { error, notice, tab, modal } = await searchParams;

  const order = await getOrderWithLooksAndItems(session.organizationId, id);
  if (!order) notFound();

  const itemTypes = await listItemTypes(session.organizationId);
  const [
    consultationNoteSources,
    consultationNotes,
    styleDirectionFiles,
    approvalBatches,
    pendingApprovalFiles,
    revisionQueueFiles,
    missingMeasurementsByItemId,
  ] = await Promise.all([
    listConsultationNoteSources(session.organizationId),
    listConsultationNotesForOrder(session.organizationId, order.id),
    listStyleDirectionFilesForOrder(session.organizationId, order.id),
    listApprovalBatchesForOrder(session.organizationId, order.id),
    listPendingApprovalFiles(session.organizationId, order.id),
    listRevisionQueueFiles(session.organizationId, order.id),
    getMissingMeasurementsForOrder(session.organizationId, order.id),
  ]);
  const measurementProfile = await getOrCreateMeasurementProfile(
    { organizationId: session.organizationId, clientId: order.clientId },
    createMeasurementProfileRepository(),
  );
  const measurementFields = await listMeasurementProfileSnapshot(session.organizationId, measurementProfile.id);
  const orderConfirmations = await listConfirmationsForSubject(session.organizationId, "order_detail", order.id);
  const styleDirectionRevisions = await listStyleDirectionFileRevisionsForFiles(
    session.organizationId,
    styleDirectionFiles.map((file) => file.id),
  );
  const revisionKeys = [
    ...styleDirectionFiles.map((file) => file.currentRevisionKey).filter((key): key is string => Boolean(key)),
    ...styleDirectionRevisions.map((revision) => revision.r2ObjectKey),
  ];
  const signedUrlEntries = await Promise.all(
    [...new Set(revisionKeys)].map(async (key) => [key, await getSignedPrivateViewUrl(key)] as const),
  );
  const signedUrlByKey = new Map(signedUrlEntries);
  const isArchived = Boolean(order.archivedAt);

  // Vendor assignment context. Assignments are looked up per Item rather than in one grouped query
  // because this page already renders Items individually, and the count here is small by design.
  const [vendors, timezone] = await Promise.all([
    listVendorsWithStats(session.organizationId),
    getOrganizationTimezone(session.organizationId),
  ]);
  const today = businessToday(timezone);
  const allItemIds = order.looks.flatMap((look) => look.items.map((item) => item.id));
  const assignmentEntries = await Promise.all(
    allItemIds.map(
      async (itemId) => [itemId, await getLiveAssignmentDetailForItem(session.organizationId, itemId)] as const,
    ),
  );
  const assignmentByItemId = new Map(assignmentEntries);

  // Finance position. The balance shown here is the same computation the completion gate enforces
  // server-side, so the button and the rule can never disagree about whether this Order is settled.
  const [invoice, vendorsAwaitingRating, outstandingAccessories, openFittings] = await Promise.all([
    getInvoiceForOrder(session.organizationId, order.id),
    listVendorsAwaitingRating(session.organizationId, order.id),
    listOutstandingAccessories(session.organizationId, order.id),
    listOpenFittingSessions(session.organizationId, order.id),
  ]);
  const [accessories, accessoryTypes, accessoryStatuses, staffMembers, fittingSessions] = await Promise.all([
    listAccessoryItemsForOrder(session.organizationId, order.id),
    listAccessoryTypes(session.organizationId),
    listAccessoryStatuses(session.organizationId),
    listStaffMembers(session.organizationId),
    listFittingSessionsForOrder(session.organizationId, order.id),
  ]);
  const fittingDetail = await Promise.all(
    fittingSessions.map(async (fitting) => ({
      fitting,
      notes: await listFittingNotes(session.organizationId, fitting.id),
      history: await listFittingHistory(session.organizationId, fitting.id),
      confirmations: await listConfirmationsForSubject(session.organizationId, "fitting_session", fitting.id),
    })),
  );
  const balance = computeOrderBalance({
    invoicedMinor: invoice ? invoice.totalMinor : null,
    paidMinor: invoice?.paidMinor ?? 0,
  });
  const invoiceStatus = invoice ? deriveInvoiceStatus({ lifecycle: invoice.lifecycle, balance }) : null;
  const invoiceMismatches = invoice ? detectPaymentMismatches({ lifecycle: invoice.lifecycle, balance }) : [];
  const canManageInvoice = canManageFinance(session.role);
  const invoiceEditable = invoice?.lifecycle === "draft";
  const isCompleted = Boolean(order.completedAt);
  const completionBlocked = blocksOrderCompletion(balance);
  const activeTab: OrderWorkspaceTab = ORDER_WORKSPACE_TABS.some((item) => item.id === tab)
    ? (tab as OrderWorkspaceTab)
    : "overview";
  const orderTabHref = (tabId: OrderWorkspaceTab) => `/orders/${order.id}?tab=${tabId}`;
  const workspaceTabs = ORDER_WORKSPACE_TABS.map((item) => ({ ...item, href: orderTabHref(item.id) }));
  const liveLooks = order.looks.filter((look) => !look.archivedAt);
  const assignedItems = liveLooks.flatMap((look) =>
    look.items
      .filter((item) => !item.archivedAt)
      .map((item) => ({ look, item, assignment: assignmentByItemId.get(item.id) }))
      .filter((entry) => entry.assignment),
  );
  const accessoryReturnTo = orderTabHref("accessories");
  const fittingsReturnTo = orderTabHref("fittings");
  const paymentsReturnTo = orderTabHref("payments");

  return (
    <div>
      <Breadcrumbs items={[{ label: "Orders", href: "/orders" }, { label: order.title }]} />
      <header className="border-b border-kuartz-line pb-8">
        <p className="eyebrow">Order</p>
        <h1 className="page-title">{order.title}</h1>
        <p className="page-description">
          <Link href={`/clients/${order.clientId}`} className="hover:underline">
            {order.clientFullName}
          </Link>{" "}
          | {dateFormatter.format(order.createdAt)}
        </p>
      </header>

      {error && !modal ? (
        <p className="form-alert mt-6" role="alert">
          {error}
        </p>
      ) : null}

      {/* Bulk assignment reports what it skipped here — a skip is never silent. */}
      {notice ? (
        <p
          className="mt-6 border-l-[3px] border-[#88925f] bg-white/70 px-4 py-3.5 text-sm leading-6 text-[#3f4a24]"
          role="status"
        >
          {notice}
        </p>
      ) : null}
      {isArchived ? <p className="form-alert mt-6">This Order is archived.</p> : null}

      <OrderWorkspaceNav tabs={workspaceTabs} activeTab={activeTab} />

      <section className={activeTab === "overview" ? "mt-9 grid gap-10 xl:grid-cols-[minmax(0,1fr)_22rem]" : "mt-9"}>
        <div className="space-y-8">
          {activeTab === "overview" ? (
          <div>
            <h2 className="section-title">Order details</h2>
            <form action={updateOrderAction} className="mt-4 space-y-4 border-y border-kuartz-line py-5">
              <input type="hidden" name="orderId" value={order.id} />
              <input type="hidden" name="returnTo" value={orderTabHref("overview")} />
              <input type="hidden" name="version" value={order.version} />
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="form-group">
                  <span>Title</span>
                  <Input name="title" defaultValue={order.title} required />
                </label>
                <label className="form-group">
                  <span>Event type</span>
                  <Input name="eventType" defaultValue={order.eventType} required />
                </label>
                <label className="form-group">
                  <span>Final agreed price (₦)</span>
                  <MoneyInput name="finalAgreedPrice" defaultValue={formatMinorUnits(order.finalAgreedPriceMinor)} required />
                </label>
                <label className="form-group">
                  <span>
                    FF discount amount (₦) <span className="font-normal text-kuartz-secondary">(optional)</span>
                  </span>
                  <MoneyInput
                    name="ffDiscountAmount"
                    defaultValue={order.ffDiscountAmountMinor != null ? formatMinorUnits(order.ffDiscountAmountMinor) : ""}
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold text-kuartz-secondary">
                <input type="checkbox" name="ffDiscount" defaultChecked={order.ffDiscount} />
                Family &amp; friends discount applied
              </label>
              <Button type="submit" variant="outline">
                Save Order details
              </Button>
            </form>
          </div>
          ) : null}

          {activeTab === "looks" ? (
          <div className="scroll-mt-8">
            <FormDisclosure title="Looks" buttonLabel="Add Look">
              <form action={createLookAction} aria-label="Add a Look" className="space-y-3 rounded-[0.95rem] border border-kuartz-line bg-[#fbfaf7] p-4 shadow-[0_18px_48px_rgba(24,24,38,0.08)]">
                <input type="hidden" name="orderId" value={order.id} />
                <input type="hidden" name="returnTo" value={orderTabHref("looks")} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="form-group">
                    <span>Name</span>
                    <Input name="name" required />
                  </label>
                  <label className="form-group">
                    <span>
                      Look date <span className="font-normal text-kuartz-secondary">(optional)</span>
                    </span>
                    <Input type="date" name="lookDate" />
                  </label>
                </div>
                <label className="form-group">
                  <span>
                    Notes <span className="font-normal text-kuartz-secondary">(optional)</span>
                  </span>
                  <textarea
                    name="notes"
                    className="min-h-[3.5rem] w-full rounded-[0.8rem] border border-kuartz-control bg-white/70 px-3.5 py-3 text-sm text-kuartz-ink outline-none focus:border-[#88925f] focus:bg-white focus:ring-4 focus:ring-kuartz-lime/20"
                  />
                </label>
                <Button type="submit" variant="outline">
                  Add Look
                </Button>
              </form>
            </FormDisclosure>
            <div className="mt-5 space-y-5">
              {order.looks.map((look, lookIndex) => (
                <LookWorkspaceAccordion
                  key={look.id}
                  orderId={order.id}
                  lookId={look.id}
                  name={look.name}
                  itemCount={look.items.length}
                  lookDate={look.lookDate}
                  archived={Boolean(look.archivedAt)}
                  defaultOpen={lookIndex === 0}
                  addItemForm={
                    <form
                      action={createItemAction}
                      aria-label={`Add Item for ${look.name}`}
                      className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_6rem_auto]"
                    >
                      <input type="hidden" name="orderId" value={order.id} />
                      <input type="hidden" name="returnTo" value={orderTabHref("looks")} />
                      <input type="hidden" name="lookId" value={look.id} />
                      <label className="form-group">
                        <span>Type</span>
                        <NativeSelect name="itemTypeId" defaultValue={itemTypes[0]?.id}>
                          {itemTypes.map((itemType) => (
                            <option key={itemType.id} value={itemType.id}>{itemType.name}</option>
                          ))}
                        </NativeSelect>
                      </label>
                      <label className="form-group">
                        <span>Custom label <span className="font-normal text-kuartz-secondary">(optional)</span></span>
                        <Input name="customLabel" placeholder="Only needed for Other" />
                      </label>
                      <label className="form-group">
                        <span>Qty</span>
                        <Input type="number" min={1} name="quantity" defaultValue={1} required />
                      </label>
                      <Button type="submit">Add Item</Button>
                    </form>
                  }
                  lifecycleAction={
                    !look.archivedAt && mayArchive("look", session.role) ? (
                      <form action={archiveLookAction}>
                        <input type="hidden" name="orderId" value={order.id} />
                        <input type="hidden" name="returnTo" value={orderTabHref("looks")} />
                        <input type="hidden" name="lookId" value={look.id} />
                        <input type="hidden" name="version" value={look.version} />
                        <Button type="submit" variant="ghost" className="w-full justify-start">Archive Look</Button>
                      </form>
                    ) : look.archivedAt && mayRestore("look", session.role) ? (
                      <form action={restoreLookAction}>
                        <input type="hidden" name="orderId" value={order.id} />
                        <input type="hidden" name="returnTo" value={orderTabHref("looks")} />
                        <input type="hidden" name="lookId" value={look.id} />
                        <input type="hidden" name="version" value={look.version} />
                        <Button type="submit" variant="ghost" className="w-full justify-start">Restore Look</Button>
                      </form>
                    ) : null
                  }
                >
                  <details className="mt-4">
                    <summary className="inline-flex min-h-11 cursor-pointer list-none items-center justify-center rounded-[0.85rem] border border-kuartz-control bg-white px-4 py-2 text-sm font-extrabold text-kuartz-ink shadow-[0_10px_24px_rgba(24,24,38,0.05)] transition hover:border-kuartz-ink/40">
                      Edit Look
                    </summary>
                  <form action={updateLookAction} className="mt-4 space-y-3 rounded-[0.95rem] border border-kuartz-line bg-[#fbfaf7] p-4">
                    <input type="hidden" name="orderId" value={order.id} />
                    <input type="hidden" name="returnTo" value={orderTabHref("looks")} />
                    <input type="hidden" name="lookId" value={look.id} />
                    <input type="hidden" name="version" value={look.version} />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="form-group">
                        <span>Name</span>
                        <Input name="name" defaultValue={look.name} required />
                      </label>
                      <label className="form-group">
                        <span>
                          Look date <span className="font-normal text-kuartz-secondary">(optional)</span>
                        </span>
                        <Input type="date" name="lookDate" defaultValue={look.lookDate ?? ""} />
                      </label>
                    </div>
                    <label className="form-group">
                      <span>
                        Notes <span className="font-normal text-kuartz-secondary">(optional)</span>
                      </span>
                      <textarea
                        name="notes"
                        defaultValue={look.notes}
                        className="min-h-[3.5rem] w-full rounded-[0.8rem] border border-kuartz-control bg-white/70 px-3.5 py-3 text-sm text-kuartz-ink outline-none focus:border-[#88925f] focus:bg-white focus:ring-4 focus:ring-kuartz-lime/20"
                      />
                    </label>
                    <Button type="submit" variant="outline">
                      Save Look
                    </Button>
                  </form>
                  </details>

                  <div>
                    <div className="space-y-3">
                      {look.items.length ? (
                        look.items.map((item) => {
                          const missingMeasurements = missingMeasurementsByItemId.get(item.id);
                          const assignment = assignmentByItemId.get(item.id) ?? null;
                          return (
                          <div key={item.id} className="py-3">
                            {missingMeasurements?.length ? (
                              <p className="mb-2 text-xs font-semibold text-[#a4562d]">
                                Missing measurements: {missingMeasurements.map((field) => field.fieldName).join(", ")}
                              </p>
                            ) : null}
                            <details className="rounded-[0.75rem] border border-kuartz-line bg-white/70">
                              <summary className="flex cursor-pointer list-none flex-col gap-2 px-4 py-3.5 marker:hidden lg:flex-row lg:items-center lg:justify-between [&::-webkit-details-marker]:hidden">
                                <span className="min-w-0">
                                  <span className="font-extrabold text-kuartz-ink">{item.customLabel ?? item.itemTypeName}</span>
                                  {item.customLabel ? <span className="ml-2 text-sm text-kuartz-secondary">{item.itemTypeName}</span> : null}
                                </span>
                                <span className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-kuartz-secondary">
                                  <span>Qty {item.quantity}</span>
                                  <span>{assignment?.vendorName ?? "No Vendor assigned"}</span>
                                  {assignment ? <span>{assignment.productionStatusName}</span> : null}
                                  {item.archivedAt ? <span>Archived</span> : null}
                                  <span className="font-bold text-kuartz-ink">Edit</span>
                                </span>
                              </summary>
                            <form action={updateItemAction} className="grid items-end gap-3 border-t border-kuartz-line p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_6rem_auto]">
                              <input type="hidden" name="orderId" value={order.id} />
                              <input type="hidden" name="returnTo" value={orderTabHref("looks")} />
                              <input type="hidden" name="itemId" value={item.id} />
                              <input type="hidden" name="version" value={item.version} />
                              <label className="form-group">
                                <span>Type</span>
                                <NativeSelect name="itemTypeId" defaultValue={item.itemTypeId}>
                                  {itemTypes.map((itemType) => (
                                    <option key={itemType.id} value={itemType.id}>
                                      {itemType.name}
                                    </option>
                                  ))}
                                </NativeSelect>
                              </label>
                              <label className="form-group">
                                <span>
                                  Custom label <span className="font-normal text-kuartz-secondary">(optional)</span>
                                </span>
                                <Input name="customLabel" defaultValue={item.customLabel ?? ""} />
                              </label>
                              <label className="form-group">
                                <span>Qty</span>
                                <Input type="number" min={1} name="quantity" defaultValue={item.quantity} required />
                              </label>
                              <Button type="submit" variant="outline">
                                Save
                              </Button>
                              {item.archivedAt ? <span className="text-xs font-semibold text-kuartz-muted">Archived</span> : null}
                            </form>
                            </details>
                            <div className="mt-2">
                              {!item.archivedAt && mayArchive("item", session.role) ? (
                                <form action={archiveItemAction}>
                                  <input type="hidden" name="orderId" value={order.id} />
                                  <input type="hidden" name="returnTo" value={orderTabHref("looks")} />
                                  <input type="hidden" name="itemId" value={item.id} />
                                  <input type="hidden" name="version" value={item.version} />
                                  <Button type="submit" variant="ghost">
                                    Archive item
                                  </Button>
                                </form>
                              ) : null}
                              {item.archivedAt && mayRestore("item", session.role) ? (
                                <form action={restoreItemAction}>
                                  <input type="hidden" name="orderId" value={order.id} />
                                  <input type="hidden" name="returnTo" value={orderTabHref("looks")} />
                                  <input type="hidden" name="itemId" value={item.id} />
                                  <input type="hidden" name="version" value={item.version} />
                                  <Button type="submit" variant="ghost">
                                    Restore item
                                  </Button>
                                </form>
                              ) : null}
                            </div>
                            {!item.archivedAt ? (
                              <ItemAssignmentDrawer
                                orderId={order.id}
                                itemId={item.id}
                                itemLabel={item.customLabel ?? item.itemTypeName}
                                assignment={assignment}
                                vendors={vendors}
                                today={today}
                              />
                            ) : null}
                          </div>
                          );
                        })
                      ) : (
                        <p className="py-3 text-sm text-kuartz-muted">No Items yet on this Look.</p>
                      )}
                    </div>

                    <LookBulkAssignForm
                      orderId={order.id}
                      lookId={look.id}
                      lookName={look.name}
                      unassignedCount={
                        look.items.filter((item) => !item.archivedAt && !assignmentByItemId.get(item.id)).length
                      }
                      vendors={vendors}
                    />

                  </div>
                </LookWorkspaceAccordion>
              ))}
            </div>

          </div>
          ) : null}

          {activeTab === "style" ? (
          <div className="scroll-mt-8 space-y-8">
            <div className="border-b border-kuartz-line pb-4">
              <p className="eyebrow">Stage 2</p>
              <h2 className="section-title mt-2">Style Direction</h2>
              <p className="mt-2 text-sm leading-6 text-kuartz-secondary">
                Add consultation notes, moodboards, sketches, fabric references, and approval-ready files for this Order.
              </p>
            </div>

          <div>
            <FormDisclosure title="Consultation Notes" buttonLabel="Add Consultation Note">
              <form action={createConsultationNoteAction} aria-label="Add a Consultation Note" className="space-y-3 rounded-[0.95rem] border border-kuartz-line bg-[#fbfaf7] p-4 shadow-[0_18px_48px_rgba(24,24,38,0.08)]">
                <input type="hidden" name="orderId" value={order.id} />
                <input type="hidden" name="returnTo" value={orderTabHref("style")} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="form-group">
                    <span>Source</span>
                    <NativeSelect name="sourceId" defaultValue={consultationNoteSources[0]?.id}>
                      {consultationNoteSources.map((source) => (
                        <option key={source.id} value={source.id}>
                          {source.name}
                        </option>
                      ))}
                    </NativeSelect>
                  </label>
                  <label className="form-group">
                    <span>Scope</span>
                    <NativeSelect name="lookId" defaultValue="">
                      <option value="">Whole order</option>
                      {order.looks.map((look) => (
                        <option key={look.id} value={look.id}>
                          {look.name}
                        </option>
                      ))}
                    </NativeSelect>
                  </label>
                </div>
                <label className="form-group">
                  <span>
                    Occurred at <span className="font-normal text-kuartz-secondary">(optional)</span>
                  </span>
                  <Input type="datetime-local" name="occurredAt" />
                </label>
                <label className="form-group">
                  <span>Body</span>
                  <textarea
                    name="body"
                    required
                    className="min-h-[4.5rem] w-full rounded-[0.8rem] border border-kuartz-control bg-white/70 px-3.5 py-3 text-sm text-kuartz-ink outline-none focus:border-[#88925f] focus:bg-white focus:ring-4 focus:ring-kuartz-lime/20"
                  />
                </label>
                <Button type="submit" variant="outline">
                  Add Consultation Note
                </Button>
              </form>
            </FormDisclosure>
            <div className="mt-4 space-y-5">
              {consultationNotes.length ? (
                consultationNotes.map((note) => (
                  <div key={note.id} role="group" aria-label={note.sourceName} className="border-y border-kuartz-line py-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-kuartz-secondary">
                          {note.sourceName} · {note.lookName ?? "Whole order"}
                        </p>
                        <p className="mt-1 text-sm text-kuartz-muted">
                          Created by {note.createdByName}
                          {note.lastEditedByName ? ` · Last edited by ${note.lastEditedByName}` : ""}
                          {note.occurredAt ? ` · Occurred ${dateFormatter.format(note.occurredAt)}` : ""}
                        </p>
                      </div>
                      {note.archivedAt ? <span className="text-xs font-semibold text-kuartz-muted">Archived</span> : null}
                    </div>

                    <form action={updateConsultationNoteAction} className="mt-4 space-y-3">
                      <input type="hidden" name="orderId" value={order.id} />
                      <input type="hidden" name="returnTo" value={orderTabHref("style")} />
                      <input type="hidden" name="noteId" value={note.id} />
                      <input type="hidden" name="version" value={note.version} />
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="form-group">
                          <span>Source</span>
                          <NativeSelect name="sourceId" defaultValue={note.sourceId}>
                            {consultationNoteSources.map((source) => (
                              <option key={source.id} value={source.id}>
                                {source.name}
                              </option>
                            ))}
                          </NativeSelect>
                        </label>
                        <label className="form-group">
                          <span>
                            Occurred at <span className="font-normal text-kuartz-secondary">(optional)</span>
                          </span>
                          <Input type="datetime-local" name="occurredAt" defaultValue={toDateTimeLocalValue(note.occurredAt)} />
                        </label>
                      </div>
                      <label className="form-group">
                        <span>Body</span>
                        <textarea
                          name="body"
                          defaultValue={note.body}
                          required
                          className="min-h-[4.5rem] w-full rounded-[0.8rem] border border-kuartz-control bg-white/70 px-3.5 py-3 text-sm text-kuartz-ink outline-none focus:border-[#88925f] focus:bg-white focus:ring-4 focus:ring-kuartz-lime/20"
                        />
                      </label>
                      <Button type="submit" variant="outline">
                        Save note
                      </Button>
                    </form>

                    {note.revisions.length ? (
                      <details className="mt-3">
                        <summary className="cursor-pointer text-xs font-semibold text-kuartz-secondary">
                          Edit history ({note.revisions.length})
                        </summary>
                        <div className="mt-2 space-y-2">
                          {note.revisions.map((revision) => (
                            <div key={revision.id} className="text-sm text-kuartz-muted">
                              <p className="font-semibold text-kuartz-ink">
                                {revision.sourceName} · {revision.authorName} · {dateFormatter.format(revision.authoredAt)}
                              </p>
                              <p>{revision.body}</p>
                            </div>
                          ))}
                        </div>
                      </details>
                    ) : null}

                    <div className="mt-3">
                      {!note.archivedAt && mayArchive("consultation_note", session.role) ? (
                        <form action={archiveConsultationNoteAction}>
                          <input type="hidden" name="orderId" value={order.id} />
                          <input type="hidden" name="returnTo" value={orderTabHref("style")} />
                          <input type="hidden" name="noteId" value={note.id} />
                          <input type="hidden" name="version" value={note.version} />
                          <Button type="submit" variant="ghost">
                            Archive note
                          </Button>
                        </form>
                      ) : null}
                      {note.archivedAt && mayRestore("consultation_note", session.role) ? (
                        <form action={restoreConsultationNoteAction}>
                          <input type="hidden" name="orderId" value={order.id} />
                          <input type="hidden" name="returnTo" value={orderTabHref("style")} />
                          <input type="hidden" name="noteId" value={note.id} />
                          <input type="hidden" name="version" value={note.version} />
                          <Button type="submit" variant="ghost">
                            Restore note
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-3 text-sm text-kuartz-muted">No Consultation Notes yet.</p>
              )}
            </div>
          </div>

          <div>
            <h2 className="section-title">Pending client approval</h2>
            <div className="mt-4 divide-y divide-kuartz-lineSoft">
              {pendingApprovalFiles.length ? (
                pendingApprovalFiles.map((file) => (
                  <a key={file.fileId} href={`#file-${file.fileId}`} className="grid gap-1 py-3 text-sm sm:grid-cols-[1fr_auto]">
                    <p className="text-kuartz-ink underline">
                      {formatStyleDirectionLabel(file.category)} · {file.lookName ?? "Whole Order"}
                    </p>
                    <p className="font-semibold text-kuartz-muted">{file.sentInActiveBatch ? "Sent. Awaiting client." : "Awaiting batch"}</p>
                  </a>
                ))
              ) : (
                <p className="py-3 text-sm text-kuartz-muted">Nothing is pending client approval.</p>
              )}
            </div>
          </div>

          <div>
            <h2 className="section-title">Needs revision</h2>
            <div className="mt-4 divide-y divide-kuartz-lineSoft">
              {revisionQueueFiles.length ? (
                revisionQueueFiles.map((file) => (
                  <a key={file.fileId} href={`#file-${file.fileId}`} className="grid gap-1 py-3 text-sm">
                    <p className="text-kuartz-ink underline">
                      {formatStyleDirectionLabel(file.category)} · {file.lookName ?? "Whole Order"} ·{" "}
                      <span className="font-semibold text-kuartz-muted">{formatStyleDirectionLabel(file.approvalStatus)}</span>
                    </p>
                    {file.decisionComment ? <p className="text-kuartz-muted">&quot;{file.decisionComment}&quot;</p> : null}
                  </a>
                ))
              ) : (
                <p className="py-3 text-sm text-kuartz-muted">No files are waiting on a revision.</p>
              )}
            </div>
          </div>

          <div>
            <FormDisclosure title="Style Direction Files" buttonLabel="Add Style Direction File">
              <form
                action={uploadStyleDirectionFileAction}
                aria-label="Add a Style Direction File"
                className="space-y-3 rounded-[0.95rem] border border-kuartz-line bg-[#fbfaf7] p-4 shadow-[0_18px_48px_rgba(24,24,38,0.08)]"
              >
                <input type="hidden" name="orderId" value={order.id} />
                <input type="hidden" name="returnTo" value={orderTabHref("style")} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="form-group">
                    <span>Category</span>
                    <NativeSelect name="category" defaultValue={STYLE_DIRECTION_FILE_CATEGORIES[0]}>
                      {STYLE_DIRECTION_FILE_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {formatStyleDirectionLabel(category)}
                        </option>
                      ))}
                    </NativeSelect>
                  </label>
                  <label className="form-group">
                    <span>Scope</span>
                    <NativeSelect name="lookId" defaultValue="">
                      <option value="">Whole order</option>
                      {order.looks.map((look) => (
                        <option key={look.id} value={look.id}>
                          {look.name}
                        </option>
                      ))}
                    </NativeSelect>
                  </label>
                </div>
                <label className="flex items-center gap-2 text-sm font-semibold text-kuartz-secondary">
                  <input type="checkbox" name="requiresClientApproval" />
                  Requires client approval
                </label>
                <label className="form-group">
                  <span>File</span>
                  <input type="file" name="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" required />
                </label>
                <Button type="submit" variant="outline">
                  Add Style Direction File
                </Button>
              </form>
            </FormDisclosure>
            <div className="mt-4 space-y-8">
              {[{ lookId: null, lookName: "Whole Order" }, ...order.looks.map((look) => ({ lookId: look.id, lookName: look.name }))].map(
                (group) => {
                  const groupFiles = styleDirectionFiles.filter((file) => file.lookId === group.lookId);
                  if (!groupFiles.length) return null;
                  return (
                    <div key={group.lookId ?? "whole-order"}>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-kuartz-secondary">{group.lookName}</h3>
                      <div className="mt-3 space-y-5">
                        {groupFiles.map((file) => {
                          const revisions = styleDirectionRevisions.filter((revision) => revision.styleDirectionFileId === file.id);
                          const currentUrl = file.currentRevisionKey ? signedUrlByKey.get(file.currentRevisionKey) : undefined;
                          return (
                            <div id={`file-${file.id}`} key={file.id} role="group" aria-label={`${formatStyleDirectionLabel(file.category)} for ${group.lookName}`} className="border-y border-kuartz-line py-5">
                              <div className="flex flex-wrap items-start justify-between gap-4">
                                <div>
                                  <p className="font-semibold text-kuartz-ink">{formatStyleDirectionLabel(file.category)}</p>
                                  <p className="mt-1 text-sm text-kuartz-muted">
                                    {file.requiresClientApproval ? "Requires client approval" : "Internal reference only"}
                                    {file.approvalStatus ? ` · ${formatStyleDirectionLabel(file.approvalStatus)}` : ""}
                                    {file.archivedAt ? " · Archived" : ""}
                                  </p>
                                </div>
                              </div>

                              {currentUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element -- private, signed R2 URL; next/image can't optimize it.
                                <img src={currentUrl} alt={formatStyleDirectionLabel(file.category)} className="mt-3 max-h-64 rounded-[0.8rem] border border-kuartz-line object-contain" />
                              ) : null}

                              <form action={reviseStyleDirectionFileAction} className="mt-4 flex flex-wrap items-end gap-3">
                                <input type="hidden" name="orderId" value={order.id} />
                                <input type="hidden" name="returnTo" value={orderTabHref("style")} />
                                <input type="hidden" name="fileId" value={file.id} />
                                <input type="hidden" name="version" value={file.version} />
                                <label className="form-group">
                                  <span>Revise</span>
                                  <input type="file" name="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" required />
                                </label>
                                <Button type="submit" variant="outline">
                                  Upload new revision
                                </Button>
                              </form>

                              {revisions.length ? (
                                <details className="mt-3">
                                  <summary className="cursor-pointer text-xs font-semibold text-kuartz-secondary">
                                    Revision history ({revisions.length})
                                  </summary>
                                  <ul className="mt-2 space-y-1 text-sm text-kuartz-muted">
                                    {revisions.map((revision) => {
                                      const revisionUrl = signedUrlByKey.get(revision.r2ObjectKey);
                                      return (
                                        <li key={revision.id}>
                                          Revision {revision.revisionNumber} · {dateFormatter.format(revision.createdAt)}
                                          {revisionUrl ? (
                                            <>
                                              {" "}
                                              ·{" "}
                                              <a href={revisionUrl} target="_blank" rel="noreferrer" className="underline">
                                                View
                                              </a>
                                            </>
                                          ) : null}
                                        </li>
                                      );
                                    })}
                                  </ul>
                                </details>
                              ) : null}

                              <div className="mt-3">
                                {!file.archivedAt && mayArchive("style_direction_file", session.role) ? (
                                  <form action={archiveStyleDirectionFileAction}>
                                    <input type="hidden" name="orderId" value={order.id} />
                                    <input type="hidden" name="returnTo" value={orderTabHref("style")} />
                                    <input type="hidden" name="fileId" value={file.id} />
                                    <input type="hidden" name="version" value={file.version} />
                                    <Button type="submit" variant="ghost">
                                      Archive file
                                    </Button>
                                  </form>
                                ) : null}
                                {file.archivedAt && mayRestore("style_direction_file", session.role) ? (
                                  <form action={restoreStyleDirectionFileAction}>
                                    <input type="hidden" name="orderId" value={order.id} />
                                    <input type="hidden" name="returnTo" value={orderTabHref("style")} />
                                    <input type="hidden" name="fileId" value={file.id} />
                                    <input type="hidden" name="version" value={file.version} />
                                    <Button type="submit" variant="ghost">
                                      Restore file
                                    </Button>
                                  </form>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                },
              )}
              {!styleDirectionFiles.length ? <p className="py-3 text-sm text-kuartz-muted">No Style Direction Files yet.</p> : null}
            </div>
          </div>
          </div>
          ) : null}

          {activeTab === "style" && canManageFinance(session.role) ? <div>
            <div className="flex items-end justify-between gap-4">
              <h2 className="section-title">Approval batches</h2>
              <Link href={`/orders/${order.id}/approval-batches/new`} className="text-sm font-semibold text-kuartz-ink underline">
                Create approval batch
              </Link>
            </div>
            <div className="mt-4 divide-y divide-kuartz-lineSoft">
              {approvalBatches.length ? (
                approvalBatches.map((batch) => (
                  <div key={batch.id} className="grid gap-1 py-3 text-sm sm:grid-cols-[1fr_auto]">
                    <p className="text-kuartz-ink">
                      Created {dateFormatter.format(batch.createdAt)}
                      {batch.deliveryMethod ? ` · ${batch.deliveryMethod === "email" ? "Emailed" : "Copied"}` : " · Not yet delivered"}
                    </p>
                    <p className="font-semibold text-kuartz-muted">{batch.status}</p>
                  </div>
                ))
              ) : (
                <p className="py-3 text-sm text-kuartz-muted">No approval batches yet.</p>
              )}
            </div>
          </div> : null}

          {activeTab === "overview" ? (
          <div>
            <h2 className="section-title">Order confirmations</h2>
            <div className="mt-4 divide-y divide-kuartz-lineSoft">
              {orderConfirmations.length ? (
                orderConfirmations.map((confirmation) => (
                  <div key={confirmation.id} className="grid gap-1 py-3 text-sm sm:grid-cols-[1fr_auto]">
                    <p className="text-kuartz-ink">
                      Created {dateFormatter.format(confirmation.createdAt)}
                      {confirmation.deliveryMethod ? ` | ${confirmation.deliveryMethod === "email" ? "Emailed" : "Copied"}` : " | Not yet delivered"}
                      {confirmation.decisionComment ? `. Comment: "${confirmation.decisionComment}"` : ""}
                    </p>
                    <p className="font-semibold text-kuartz-muted">{confirmation.status}</p>
                  </div>
                ))
              ) : (
                <p className="py-3 text-sm text-kuartz-muted">No order confirmations sent yet.</p>
              )}
            </div>
            <form action={issueOrderConfirmationAction} className="mt-4">
              <input type="hidden" name="orderId" value={order.id} />
              <Button type="submit" variant="outline">
                Send order confirmation
              </Button>
            </form>
          </div>
          ) : null}

          {activeTab === "measurements" ? (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="section-title">Measurements</h2>
                  <p className="mt-2 text-sm leading-6 text-kuartz-secondary">
                    These measurements come from the client profile. Updates here also update the client profile.
                  </p>
                </div>
                <MeasurementDrawer
                  clientId={order.clientId}
                  measurementProfileId={measurementProfile.id}
                  fields={measurementFields}
                  returnTo={orderTabHref("measurements")}
                  canAddCustomFields={canManageMeasurementFieldDefinitions(session.role)}
                  disabled={Boolean(measurementProfile.archivedAt)}
                />
              </div>
              {measurementProfile.archivedAt ? <p className="mt-3 text-sm text-kuartz-muted">This measurement profile is archived.</p> : null}
              <div className="mt-5 divide-y divide-kuartz-line border-y border-kuartz-line">
                {measurementFields.length ? (
                  measurementFields.map((field) => (
                    <div key={field.fieldId} className="grid gap-3 py-4 text-sm sm:grid-cols-[minmax(11rem,0.32fr)_minmax(0,1fr)]">
                      <div>
                        <p className="font-semibold text-kuartz-ink">{field.fieldName}</p>
                        <p className="mt-1 text-xs text-kuartz-muted">{field.unit}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-kuartz-ink">{field.value ? `${field.value} ${field.unit}` : "Not recorded yet"}</p>
                        {field.value ? (
                          <p className="mt-1 text-xs text-kuartz-muted">
                            {field.lastEditedByName ? `Last edited by ${field.lastEditedByName}` : `Set by ${field.createdByName}`}
                            {field.lastEditedAt ? ` - ${dateFormatter.format(field.lastEditedAt)}` : ""}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="py-8 text-sm text-kuartz-muted">No measurement fields have been set up yet.</p>
                )}
              </div>
              <div className="mt-5 rounded-[1rem] border border-kuartz-line bg-white/65 p-5">
                <p className="font-semibold text-kuartz-ink">Measurement requirements</p>
                <p className="mt-2 text-sm leading-6 text-kuartz-secondary">
                  Missing measurements appear beside items. Vendor brief export is blocked until required measurements are added or a Super Admin overrides.
                </p>
              </div>
            </div>
          ) : null}

          {activeTab === "vendors" ? (
            <div>
              <h2 className="section-title">Vendors</h2>
              {assignedItems.length ? (
                <div className="mt-4 divide-y divide-kuartz-line border-y border-kuartz-line">
                  {assignedItems.map(({ look, item, assignment }) => (
                    <div key={item.id} className="grid gap-3 py-4 text-sm md:grid-cols-[1fr_1fr_auto] md:items-center">
                      <div>
                        <p className="font-semibold text-kuartz-ink">{item.customLabel ?? item.itemTypeName}</p>
                        <p className="mt-1 text-xs text-kuartz-muted">{look.name}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-kuartz-ink">{assignment?.vendorName}</p>
                        <p className="mt-1 text-xs text-kuartz-muted">
                          Due {assignment ? formatBusinessDate(assignment.deadline) : "-"}
                        </p>
                      </div>
                      <ItemAssignmentDrawer
                        itemId={item.id}
                        itemLabel={item.customLabel ?? item.itemTypeName}
                        orderId={order.id}
                        assignment={assignment ?? null}
                        vendors={vendors}
                        today={today}
                        returnTo={orderTabHref("vendors")}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  className="mt-4"
                  title="No Vendors assigned"
                  description="Assign vendors to items once the production plan is ready."
                />
              )}
            </div>
          ) : null}

          {activeTab === "production" ? (
            <div>
              <h2 className="section-title">Production</h2>
              {assignedItems.length ? (
                <div className="mt-4 divide-y divide-kuartz-line border-y border-kuartz-line">
                  {assignedItems.map(({ look, item, assignment }) => (
                    <div key={item.id} className="grid gap-3 py-4 text-sm md:grid-cols-[1fr_auto_auto] md:items-center">
                      <div>
                        <p className="font-semibold text-kuartz-ink">{item.customLabel ?? item.itemTypeName}</p>
                        <p className="mt-1 text-xs text-kuartz-muted">
                          {look.name} | {assignment?.vendorName} | Due{" "}
                          {assignment ? formatBusinessDate(assignment.deadline) : "-"}
                        </p>
                      </div>
                      <span className="w-fit rounded-full border border-kuartz-line bg-[#f6f6f3] px-2.5 py-0.5 text-xs font-semibold text-kuartz-secondary">
                        {assignment?.productionStatusName}
                      </span>
                      <Button asChild variant="outline">
                        <Link href={`/production/${assignment?.id}`}>Update</Link>
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  className="mt-4"
                  title="No Production items yet"
                  description="Production starts once an item has a vendor."
                />
              )}
            </div>
          ) : null}

          {activeTab === "accessories" ? (
            <div>
              {accessoryTypes.length && accessoryStatuses.length ? (
                <FormModal
                  title="Accessories"
                  modalTitle="Add accessory"
                  buttonLabel="Add Accessory"
                  eyebrow="Accessories"
                  formId="add-order-accessory-form"
                  submitLabel="Add Accessory"
                  pendingLabel="Adding accessory..."
                  size="lg"
                  error={modal === "accessory" ? error : undefined}
                >
                  <form id="add-order-accessory-form" action={createAccessoryItemAction} className="grid gap-4 sm:grid-cols-2">
                    <input type="hidden" name="orderId" value={order.id} />
                    <input type="hidden" name="returnTo" value={accessoryReturnTo} />
                    <label className="form-group">
                      <span>Type <span className="font-normal text-kuartz-secondary">(required)</span></span>
                      <NativeSelect name="accessoryTypeId" required data-modal-autofocus>
                        {accessoryTypes.map((type) => (
                          <option key={type.id} value={type.id}>{type.name}</option>
                        ))}
                      </NativeSelect>
                    </label>
                    <label className="form-group">
                      <span>Status <span className="font-normal text-kuartz-secondary">(required)</span></span>
                      <NativeSelect name="accessoryStatusId" required>
                        {accessoryStatuses.map((status) => (
                          <option key={status.id} value={status.id}>{status.name}</option>
                        ))}
                      </NativeSelect>
                    </label>
                    <label className="form-group">
                      <span>Look <span className="font-normal text-kuartz-secondary">(optional)</span></span>
                      <NativeSelect name="lookId" defaultValue="">
                        <option value="">Whole Order</option>
                        {liveLooks.map((look) => (
                          <option key={look.id} value={look.id}>{look.name}</option>
                        ))}
                      </NativeSelect>
                    </label>
                    <label className="form-group">
                      <span>Label <span className="font-normal text-kuartz-secondary">(optional)</span></span>
                      <Input name="customLabel" maxLength={120} placeholder="e.g. Black oxfords, size 44" />
                    </label>
                    <label className="form-group">
                      <span>Assigned staff <span className="font-normal text-kuartz-secondary">(optional)</span></span>
                      <NativeSelect name="assignedToStaffId" defaultValue="">
                        <option value="">Unassigned</option>
                        {staffMembers.map((staff) => (
                          <option key={staff.userId} value={staff.userId}>{staff.fullName}</option>
                        ))}
                      </NativeSelect>
                    </label>
                    <label className="form-group">
                      <span>Supplier <span className="font-normal text-kuartz-secondary">(optional)</span></span>
                      <Input name="supplier" maxLength={160} />
                    </label>
                    <label className="form-group">
                      <span>Budget <span className="font-normal text-kuartz-secondary">(optional)</span></span>
                      <MoneyInput name="budget" />
                    </label>
                    <label className="form-group">
                      <span>Purchase date <span className="font-normal text-kuartz-secondary">(optional)</span></span>
                      <Input name="purchaseDate" type="date" />
                    </label>
                    <label className="form-group sm:col-span-2">
                      <span>Notes <span className="font-normal text-kuartz-secondary">(optional)</span></span>
                      <textarea name="notes" className={textareaClass} />
                    </label>
                  </form>
                </FormModal>
              ) : (
                <h2 className="section-title">Accessories</h2>
              )}
              {!accessoryTypes.length || !accessoryStatuses.length ? (
                <p className="mt-4 border-l-[3px] border-[#88925f] bg-white/70 px-4 py-3.5 text-sm leading-6 text-[#3f4a24]">
                  A Super Admin needs to set accessory types and statuses in Settings first.
                </p>
              ) : null}
              {accessories.length ? (
                <div className="mt-4 divide-y divide-kuartz-line border-y border-kuartz-line">
                  {accessories.map((accessory) => (
                    <form key={accessory.id} action={updateAccessoryItemAction} className="space-y-4 py-5">
                      <input type="hidden" name="orderId" value={order.id} />
                      <input type="hidden" name="returnTo" value={accessoryReturnTo} />
                      <input type="hidden" name="accessoryItemId" value={accessory.id} />
                      <input type="hidden" name="version" value={accessory.version} />
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="font-semibold text-kuartz-ink">{accessory.label}</h3>
                        <p className="text-xs text-kuartz-muted">
                          {accessory.deliveryDate.state === "inherited"
                            ? `Due ${formatBusinessDate(accessory.deliveryDate.date)}${accessory.lookName ? ` | ${accessory.lookName}` : ""}`
                            : "No due date"}
                        </p>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="form-group">
                          <span>Type</span>
                          <NativeSelect name="accessoryTypeId" defaultValue={accessory.accessoryTypeId}>
                            {accessoryTypes.map((type) => (
                              <option key={type.id} value={type.id}>{type.name}</option>
                            ))}
                          </NativeSelect>
                        </label>
                        <label className="form-group">
                          <span>Status</span>
                          <NativeSelect name="accessoryStatusId" defaultValue={accessory.accessoryStatusId}>
                            {accessoryStatuses.map((status) => (
                              <option key={status.id} value={status.id}>{status.name}</option>
                            ))}
                          </NativeSelect>
                        </label>
                        <label className="form-group">
                          <span>Look <span className="font-normal text-kuartz-secondary">(optional)</span></span>
                          <NativeSelect name="lookId" defaultValue={accessory.lookId ?? ""}>
                            <option value="">Whole Order</option>
                            {liveLooks.map((look) => (
                              <option key={look.id} value={look.id}>{look.name}</option>
                            ))}
                          </NativeSelect>
                        </label>
                        <label className="form-group">
                          <span>Label <span className="font-normal text-kuartz-secondary">(optional)</span></span>
                          <Input name="customLabel" defaultValue={accessory.customLabel ?? ""} maxLength={120} />
                        </label>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {!accessory.archivedAt ? <Button type="submit" variant="outline">Save Accessory</Button> : null}
                        {!accessory.archivedAt && mayArchive("accessory_item", session.role) ? (
                          <Button formAction={archiveAccessoryItemAction} type="submit" variant="outline">Cancel Accessory</Button>
                        ) : null}
                        {accessory.archivedAt && mayRestore("accessory_item", session.role) ? (
                          <Button formAction={restoreAccessoryItemAction} type="submit" variant="outline">Restore Accessory</Button>
                        ) : null}
                      </div>
                    </form>
                  ))}
                </div>
              ) : (
                <EmptyState className="mt-4" title="No Accessories yet" description="Add accessories sourced alongside this order." />
              )}
            </div>
          ) : null}

          {activeTab === "fittings" ? (
            <div>
              <FormDisclosure title="Fittings" buttonLabel="Schedule Fitting">
                <form action={scheduleFittingAction} className="grid gap-4 border-t border-kuartz-line pt-5 sm:grid-cols-2">
                  <input type="hidden" name="orderId" value={order.id} />
                  <input type="hidden" name="returnTo" value={fittingsReturnTo} />
                  <label className="form-group">
                    <span>Date and time</span>
                    <Input type="datetime-local" name="scheduledAt" required />
                  </label>
                  <label className="form-group">
                    <span>Look <span className="font-normal text-kuartz-secondary">(optional)</span></span>
                    <NativeSelect name="lookId" defaultValue="">
                      <option value="">Whole Order</option>
                      {liveLooks.map((look) => (
                        <option key={look.id} value={look.id}>{look.name}</option>
                      ))}
                    </NativeSelect>
                  </label>
                  <label className="form-group sm:col-span-2">
                    <span>Location <span className="font-normal text-kuartz-secondary">(optional)</span></span>
                    <Input name="location" maxLength={160} />
                  </label>
                  <Button type="submit" className="sm:col-span-2">Schedule Fitting</Button>
                </form>
              </FormDisclosure>
              {fittingDetail.length ? (
                <div className="mt-4 space-y-6">
                  {fittingDetail.map(({ fitting, notes, history, confirmations }) => {
                    const terminal = isTerminalFittingStatus(fitting.status);
                    return (
                      <div key={fitting.id} className="border-y border-kuartz-line py-5">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <div>
                            <h3 className="font-semibold text-kuartz-ink">{dateFormatter.format(fitting.scheduledAt)}</h3>
                            <p className="mt-1 text-xs text-kuartz-muted">
                              {fitting.lookName ?? "Whole Order"}{fitting.location ? ` | ${fitting.location}` : ""}
                            </p>
                          </div>
                          <span className="rounded-full border border-kuartz-line bg-[#f6f6f3] px-2.5 py-0.5 text-xs font-semibold text-kuartz-secondary">
                            {FITTING_STATUS_LABELS[fitting.status]}
                          </span>
                        </div>
                        {!terminal && !fitting.archivedAt ? (
                          <div className="mt-5 grid gap-5 lg:grid-cols-2">
                            <form action={rescheduleFittingAction} className="space-y-3">
                              <input type="hidden" name="orderId" value={order.id} />
                              <input type="hidden" name="returnTo" value={fittingsReturnTo} />
                              <input type="hidden" name="sessionId" value={fitting.id} />
                              <input type="hidden" name="version" value={fitting.version} />
                              <label className="form-group">
                                <span className="text-xs">New date and time</span>
                                <Input type="datetime-local" name="scheduledAt" defaultValue={toDateTimeLocalValue(fitting.scheduledAt)} required />
                              </label>
                              <label className="form-group">
                                <span className="text-xs">Location <span className="font-normal text-kuartz-secondary">(optional)</span></span>
                                <Input name="location" defaultValue={fitting.location} maxLength={160} />
                              </label>
                              <input type="hidden" name="note" value="" />
                              <Button type="submit" variant="outline">Reschedule</Button>
                            </form>
                            <form action={changeFittingStatusAction} className="space-y-3">
                              <input type="hidden" name="orderId" value={order.id} />
                              <input type="hidden" name="returnTo" value={fittingsReturnTo} />
                              <input type="hidden" name="sessionId" value={fitting.id} />
                              <input type="hidden" name="version" value={fitting.version} />
                              <label className="form-group">
                                <span className="text-xs">New status</span>
                                <NativeSelect name="newStatus" defaultValue="completed">
                                  {FITTING_SESSION_STATUSES.filter((status) => status !== fitting.status).map((status) => (
                                    <option key={status} value={status}>{FITTING_STATUS_LABELS[status]}</option>
                                  ))}
                                </NativeSelect>
                              </label>
                              <label className="form-group">
                                <span className="text-xs">Note <span className="font-normal text-kuartz-secondary">(optional)</span></span>
                                <Input name="note" maxLength={300} />
                              </label>
                              <Button type="submit" variant="outline">Save status</Button>
                            </form>
                          </div>
                        ) : null}
                        <form action={updateFittingSummaryAction} className="mt-5 space-y-3">
                          <input type="hidden" name="orderId" value={order.id} />
                          <input type="hidden" name="returnTo" value={fittingsReturnTo} />
                          <input type="hidden" name="sessionId" value={fitting.id} />
                          <input type="hidden" name="version" value={fitting.version} />
                          <label className="form-group">
                            <span>Client-facing summary <span className="font-normal text-kuartz-secondary">(client sees this)</span></span>
                            <textarea name="clientSummary" defaultValue={fitting.clientSummary} className={textareaClass} />
                          </label>
                          <Button type="submit" variant="outline">Save summary</Button>
                        </form>
                        <div className="mt-5">
                          <h3 className="text-sm font-semibold text-kuartz-body">Internal notes</h3>
                          {notes.length ? (
                            <ol className="mt-2 divide-y divide-kuartz-lineSoft border-y border-kuartz-lineSoft">
                              {notes.map((note) => (
                                <li key={note.id} className="py-2 text-sm text-kuartz-body">{note.note}</li>
                              ))}
                            </ol>
                          ) : <p className="mt-2 text-sm text-kuartz-muted">No notes yet.</p>}
                          <FormDisclosure title="Fitting notes" buttonLabel="Add note">
                            <form action={addFittingNoteAction} className="flex flex-wrap items-end gap-2 border-t border-kuartz-line pt-4">
                              <input type="hidden" name="orderId" value={order.id} />
                              <input type="hidden" name="returnTo" value={fittingsReturnTo} />
                              <input type="hidden" name="sessionId" value={fitting.id} />
                              <label className="form-group flex-1">
                                <span className="text-xs">Note</span>
                                <Input name="note" required maxLength={300} />
                              </label>
                              <Button type="submit" variant="outline">Add note</Button>
                            </form>
                          </FormDisclosure>
                        </div>
                        <div className="mt-5 flex flex-wrap gap-3">
                          {fitting.status === "completed" && !fitting.archivedAt ? (
                            <form action={issueFittingConfirmationAction}>
                              <input type="hidden" name="orderId" value={order.id} />
                              <input type="hidden" name="sessionId" value={fitting.id} />
                              <Button type="submit" variant="outline">Send confirmation link</Button>
                            </form>
                          ) : null}
                          {!fitting.archivedAt && mayArchive("fitting_session", session.role) ? (
                            <form action={archiveFittingAction}>
                              <input type="hidden" name="orderId" value={order.id} />
                              <input type="hidden" name="returnTo" value={fittingsReturnTo} />
                              <input type="hidden" name="sessionId" value={fitting.id} />
                              <input type="hidden" name="version" value={fitting.version} />
                              <Button type="submit" variant="outline">Archive Fitting</Button>
                            </form>
                          ) : null}
                          {fitting.archivedAt && mayRestore("fitting_session", session.role) ? (
                            <form action={restoreFittingAction}>
                              <input type="hidden" name="orderId" value={order.id} />
                              <input type="hidden" name="returnTo" value={fittingsReturnTo} />
                              <input type="hidden" name="sessionId" value={fitting.id} />
                              <input type="hidden" name="version" value={fitting.version} />
                              <Button type="submit" variant="outline">Restore Fitting</Button>
                            </form>
                          ) : null}
                        </div>
                        <p className="mt-4 text-xs text-kuartz-muted">
                          Confirmations: {confirmations.length} | History entries: {history.length}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState className="mt-4" title="No Fittings yet" description="Schedule fitting sessions when the order is ready." />
              )}
            </div>
          ) : null}

          {activeTab === "payments" ? (
            <div>
              <h2 className="section-title">Payments</h2>
              <EmbeddedPayments
                orderId={order.id}
                invoice={invoice}
                balance={balance}
                invoiceStatus={invoiceStatus}
                invoiceMismatches={invoiceMismatches}
                canManageInvoice={canManageInvoice}
                invoiceEditable={invoiceEditable}
                today={today}
                returnTo={paymentsReturnTo}
                error={modal === "payment" ? error : undefined}
              />
            </div>
          ) : null}
        </div>

        {activeTab === "overview" ? (
        <aside className="space-y-9">
          <div>
            <h2 className="section-title">Workflow</h2>
            <div className="mt-4 grid gap-2 border-t border-kuartz-line pt-4 text-sm">
              <Link
                href={`/orders/${order.id}/accessories`}
                className="font-semibold text-kuartz-ink underline-offset-4 hover:underline"
              >
                Accessories
                {outstandingAccessories.length ? ` | ${outstandingAccessories.length} outstanding` : ""}
              </Link>
              <Link
                href={`/orders/${order.id}/fittings`}
                className="font-semibold text-kuartz-ink underline-offset-4 hover:underline"
              >
                Fittings{openFittings.length ? ` | ${openFittings.length} scheduled` : ""}
              </Link>
              <Link
                href={`/orders/${order.id}/vendor-ratings`}
                className="font-semibold text-kuartz-ink underline-offset-4 hover:underline"
              >
                Vendor ratings
              </Link>
            </div>
          </div>

          <div>
            <div className="flex items-end justify-between gap-4">
              <h2 className="section-title">Invoice</h2>
              <Link href={`/orders/${order.id}/invoice`} className="text-sm font-semibold text-kuartz-ink underline">
                {invoice ? "Open" : "Create"}
              </Link>
            </div>
            <dl className="mt-4 space-y-2 border-t border-kuartz-line pt-4 text-sm">
              {balance.state === "not_invoiced" ? (
                <p className="text-kuartz-muted">Not invoiced yet.</p>
              ) : (
                <>
                  <div className="flex justify-between">
                    <dt className="text-kuartz-secondary">Status</dt>
                    <dd className="font-semibold text-kuartz-ink">
                      {invoiceStatus ? INVOICE_STATUS_LABELS[invoiceStatus] : "-"}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-kuartz-secondary">Invoiced</dt>
                    <dd className="text-kuartz-ink">₦{formatMinorUnits(balance.invoicedMinor)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-kuartz-secondary">Paid</dt>
                    <dd className="text-kuartz-ink">₦{formatMinorUnits(balance.paidMinor)}</dd>
                  </div>
                  <div className="flex justify-between border-t border-kuartz-line pt-2">
                    <dt className="font-semibold text-kuartz-ink">Balance</dt>
                    <dd className="font-semibold text-kuartz-ink">₦{formatMinorUnits(balance.balanceMinor)}</dd>
                  </div>
                </>
              )}
            </dl>
          </div>

          <div>
            <h2 className="section-title">Delivery and completion</h2>
            {isCompleted ? (
              <div className="mt-4 border-t border-kuartz-line pt-4">
                <p className="text-sm text-kuartz-ink">
                  Completed {order.completedAt ? dateFormatter.format(order.completedAt) : ""}.
                </p>
                {order.completionOverrideReason ? (
                  <p className="mt-2 text-sm leading-6 text-[#8c1d1d]">
                    Completed with an outstanding balance. Reason: {order.completionOverrideReason}
                  </p>
                ) : null}
                {/* The rating prompts ticket 30 surfaces. Capture itself already exists on its own
                    page; completion is what makes it due. */}
                {vendorsAwaitingRating.length ? (
                  <div className="mt-4 border-l-[3px] border-[#88925f] bg-white/70 px-4 py-3.5">
                    <p className="text-sm leading-6 text-[#3f4a24]">
                      Rate the {vendorsAwaitingRating.length} Vendor
                      {vendorsAwaitingRating.length === 1 ? "" : "s"} who worked on this Order.
                    </p>
                    <Link
                      href={`/orders/${order.id}/vendor-ratings`}
                      className="mt-2 inline-block text-sm font-semibold text-kuartz-ink underline"
                    >
                      Rate Vendors
                    </Link>
                  </div>
                ) : null}
              </div>
            ) : (
              <form action={completeOrderAction} className="mt-4 space-y-4 border-t border-kuartz-line pt-4">
                <input type="hidden" name="orderId" value={order.id} />
                <p className="text-sm leading-6 text-kuartz-secondary">
                  {completionBlocked
                    ? canManageFinance(session.role)
                      ? balance.state === "not_invoiced"
                        ? "This Order has not been invoiced, so nothing can have been settled."
                        : `₦${formatMinorUnits(balance.balanceMinor)} is still outstanding.`
                      : "A financial balance is still outstanding."
                    : "The client balance is settled."}
                </p>

                {/* Accessories and Fittings warn but never block: the payment gate is the only hard
                    gate the spec defines, and a forgotten accessory should not strand an Order. */}
                {outstandingAccessories.length || openFittings.length ? (
                  <div className="border-l-[3px] border-[#c8a45c] bg-white/70 px-4 py-3 text-sm leading-6 text-[#6b4f14]">
                    <p className="font-semibold">Still open on this Order</p>
                    {outstandingAccessories.length ? (
                      <p className="mt-1">
                        {outstandingAccessories.length} Accessor
                        {outstandingAccessories.length === 1 ? "y" : "ies"} not yet delivered:{" "}
                        {outstandingAccessories.map((accessory) => accessory.label).join(", ")}
                      </p>
                    ) : null}
                    {openFittings.length ? (
                      <p className="mt-1">
                        {openFittings.length} Fitting{openFittings.length === 1 ? "" : "s"} still scheduled.
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs">Completing anyway is allowed. This is a reminder, not a block.</p>
                  </div>
                ) : null}
                {completionBlocked && canOverrideCompletionGate(session.role) ? (
                  <label className="form-group">
                    <span>Override reason</span>
                    <Input name="overrideReason" required placeholder="Why this Order is completing unsettled" />
                  </label>
                ) : null}
                {completionBlocked && !canOverrideCompletionGate(session.role) ? (
                  <p className="rounded-[0.8rem] border border-[#f0b4b4] bg-[#fdf0f0] px-3 py-2.5 text-sm leading-6 text-[#8c1d1d]">
                    A Super Admin must override the outstanding balance to complete this Order.
                  </p>
                ) : (
                  <Button className="w-full" type="submit" variant={completionBlocked ? "outline" : "default"}>
                    Mark delivered and complete
                  </Button>
                )}
              </form>
            )}
          </div>

          {!isArchived && mayArchive("order", session.role) ? (
            <form action={archiveOrderAction}>
              <input type="hidden" name="orderId" value={order.id} />
              <input type="hidden" name="returnTo" value={orderTabHref("overview")} />
              <input type="hidden" name="version" value={order.version} />
              <Button type="submit" variant="outline" className="w-full">
                Archive Order
              </Button>
            </form>
          ) : null}

          {isArchived && mayRestore("order", session.role) ? (
            <form action={restoreOrderAction}>
              <input type="hidden" name="orderId" value={order.id} />
              <input type="hidden" name="returnTo" value={orderTabHref("overview")} />
              <input type="hidden" name="version" value={order.version} />
              <Button type="submit" variant="outline" className="w-full">
                Restore Order
              </Button>
            </form>
          ) : null}
        </aside>
        ) : null}
      </section>
    </div>
  );
}

type OrderInvoice = Awaited<ReturnType<typeof getInvoiceForOrder>>;
type OrderBalance = ReturnType<typeof computeOrderBalance>;

function EmbeddedPayments({
  orderId,
  invoice,
  balance,
  invoiceStatus,
  invoiceMismatches,
  canManageInvoice,
  invoiceEditable,
  today,
  returnTo,
  error,
}: {
  orderId: string;
  invoice: OrderInvoice;
  balance: OrderBalance;
  invoiceStatus: ReturnType<typeof deriveInvoiceStatus> | null;
  invoiceMismatches: ReturnType<typeof detectPaymentMismatches>;
  canManageInvoice: boolean;
  invoiceEditable: boolean;
  today: string;
  returnTo: string;
  error?: string;
}) {
  if (!invoice) {
    return canManageInvoice ? (
      <form action={createInvoiceAction} className="mt-4 max-w-3xl space-y-4 border-y border-kuartz-line py-5">
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <InvoiceFields issueDate={today} dueDate={null} notes="" paymentInstructions="" lines={[]} />
        <Button type="submit">Create Invoice</Button>
      </form>
    ) : (
      <EmptyState className="mt-4" title="No Invoice yet" description="Create an invoice before recording payments." />
    );
  }

  return (
    <>
      {invoiceMismatches.length ? (
        <div className="mt-4 space-y-2">
          {invoiceMismatches.map((mismatch) => (
            <p key={mismatch.kind} className="form-alert" role="alert">
              {mismatch.kind === "overpaid"
                ? `Overpaid by N${formatMinorUnits(mismatch.excessMinor)}. Check the payment records.`
                : mismatch.kind === "paid_against_void"
                  ? "Payments are linked to a cancelled invoice. Review the records."
                  : "Payments were recorded before this invoice was sent. Confirm this is correct."}
            </p>
          ))}
        </div>
      ) : null}

      <section className="mt-4 grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-8">
          <div>
            <h3 className="font-semibold text-kuartz-ink">Invoice items</h3>
            {invoiceEditable && canManageInvoice ? (
              <form action={updateInvoiceAction} className="mt-4 space-y-4 border-y border-kuartz-line py-5">
                <input type="hidden" name="orderId" value={orderId} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <input type="hidden" name="invoiceId" value={invoice.id} />
                <input type="hidden" name="version" value={invoice.version} />
                <InvoiceFields
                  issueDate={invoice.issueDate}
                  dueDate={invoice.dueDate}
                  notes={invoice.notes}
                  paymentInstructions={invoice.paymentInstructions}
                  lines={invoice.lines}
                />
                <Button type="submit" variant="outline">Save Invoice</Button>
              </form>
            ) : (
              <div className="mt-4 border-y border-kuartz-line py-2">
                {invoice.lines.map((line) => (
                  <div key={line.id} className="grid grid-cols-[1fr_auto] gap-4 py-3 text-sm">
                    <div>
                      <p className="text-kuartz-ink">{line.description}</p>
                      <p className="mt-1 text-xs text-kuartz-muted">
                        {line.quantity} x N{formatMinorUnits(line.unitPriceMinor)}
                      </p>
                    </div>
                    <p className="font-semibold text-kuartz-ink">N{formatMinorUnits(computeLineAmountMinor(line))}</p>
                  </div>
                ))}
              </div>
            )}
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-kuartz-secondary">Status</dt>
                <dd className="font-semibold text-kuartz-ink">
                  {invoiceStatus ? INVOICE_STATUS_LABELS[invoiceStatus] : "-"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-kuartz-secondary">Total invoiced</dt>
                <dd className="font-semibold text-kuartz-ink">N{formatMinorUnits(invoice.totalMinor)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-kuartz-secondary">Paid</dt>
                <dd className="text-kuartz-ink">N{formatMinorUnits(invoice.paidMinor)}</dd>
              </div>
              <div className="flex justify-between border-t border-kuartz-line pt-2">
                <dt className="font-semibold text-kuartz-ink">Balance</dt>
                <dd className="font-semibold text-kuartz-ink">
                  N{formatMinorUnits(balance.state === "invoiced" ? balance.balanceMinor : 0)}
                </dd>
              </div>
            </dl>
          </div>

          <div>
            <h3 className="font-semibold text-kuartz-ink">Client payments</h3>
            {invoice.payments.length ? (
              <ol className="mt-4 divide-y divide-kuartz-line border-y border-kuartz-line">
                {invoice.payments.map((payment) => (
                  <li key={payment.id} className="py-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className={`text-sm font-semibold ${payment.voidedAt ? "text-kuartz-muted line-through" : "text-kuartz-ink"}`}>
                        N{formatMinorUnits(payment.amountMinor)}
                      </p>
                      <p className="text-xs text-kuartz-muted">{payment.paidOn} | {payment.recordedByName}</p>
                    </div>
                    {payment.reference ? <p className="mt-1 text-sm text-kuartz-secondary">{payment.reference}</p> : null}
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState className="mt-4" title="No payments recorded" description="No client payments have been added yet." />
            )}
          </div>
        </div>

        {canManageInvoice ? (
          <aside className="space-y-8">
            <FormModal
              title="Payments"
              modalTitle="Record payment"
              buttonLabel="Record payment"
              eyebrow="Payments"
              formId="record-order-payment-form"
              submitLabel="Record payment"
              pendingLabel="Recording payment..."
              size="sm"
              error={error}
            >
              <form id="record-order-payment-form" action={recordClientPaymentAction} className="space-y-4">
                <input type="hidden" name="orderId" value={orderId} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <input type="hidden" name="invoiceId" value={invoice.id} />
                <label className="form-group">
                  <span>Amount <span className="font-normal text-kuartz-secondary">(required)</span></span>
                  <MoneyInput name="amount" required data-modal-autofocus />
                </label>
                <label className="form-group">
                  <span>Paid on <span className="font-normal text-kuartz-secondary">(required)</span></span>
                  <Input type="date" name="paidOn" defaultValue={today} required />
                </label>
                <label className="form-group">
                  <span>Reference <span className="font-normal text-kuartz-secondary">(optional)</span></span>
                  <Input name="reference" maxLength={200} />
                </label>
              </form>
            </FormModal>
            {invoice.lifecycle !== "void" ? (
              <>
                {!invoice.sentAt ? <SendInvoiceButton invoiceId={invoice.id} /> : null}
                <form action={voidInvoiceAction} className="space-y-4 border-t border-kuartz-line pt-5">
                  <input type="hidden" name="orderId" value={orderId} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <input type="hidden" name="invoiceId" value={invoice.id} />
                  <input type="hidden" name="version" value={invoice.version} />
                  <label className="form-group">
                    <span>Void reason</span>
                    <Input name="reason" required />
                  </label>
                  <Button className="w-full" type="submit" variant="outline">Void Invoice</Button>
                </form>
              </>
            ) : null}
          </aside>
        ) : null}
      </section>
    </>
  );
}

function InvoiceFields({
  issueDate,
  dueDate,
  notes,
  paymentInstructions,
  lines,
}: {
  issueDate: string;
  dueDate: string | null;
  notes: string;
  paymentInstructions: string;
  lines: { description: string; quantity: number; unitPriceMinor: number }[];
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="form-group">
          <span>Issue date</span>
          <Input type="date" name="issueDate" defaultValue={issueDate} required />
        </label>
        <label className="form-group">
          <span>Due date <span className="font-normal text-kuartz-secondary">(optional)</span></span>
          <Input type="date" name="dueDate" defaultValue={dueDate ?? ""} />
        </label>
      </div>
      <InvoiceLineItemsFields lines={lines} />
      <label className="form-group">
        <span>Payment instructions <span className="font-normal text-kuartz-secondary">(optional)</span></span>
        <textarea name="paymentInstructions" defaultValue={paymentInstructions} className={textareaClass} />
      </label>
      <label className="form-group">
        <span>Notes <span className="font-normal text-kuartz-secondary">(optional)</span></span>
        <textarea name="notes" defaultValue={notes} className={textareaClass} />
      </label>
    </>
  );
}
