import Link from "next/link";
import { notFound } from "next/navigation";
import { addProductionNoteAction, changeProductionStatusAction } from "@/app/actions/vendor-assignments";
import { recordVendorPaymentAction, voidVendorPaymentAction } from "@/app/actions/payments";
import { UrgencyBadge } from "@/components/production/urgency-badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { requireStaffSession } from "@/lib/auth/session";
import { businessToday } from "@/lib/domain/business-date";
import { canManageFinance } from "@/lib/domain/access-control";
import { computeVendorPaymentPosition } from "@/lib/finance/balances";
import { listVendorPayments, sumLiveVendorPaymentsMinor } from "@/lib/finance/repository";
import { formatMinorUnits } from "@/lib/forms/money";
import { getOrganizationTimezone } from "@/lib/organizations/repository";
import { getSignedPrivateViewUrl } from "@/lib/storage/r2";
import { listProductionStatuses } from "@/lib/production-statuses/repository";
import { getAssignmentDetail } from "@/lib/production/assignment-repository";
import { listProductionNotes, listStatusHistory } from "@/lib/production/status-change-repository";
import { describeUrgency } from "@/lib/production/urgency";
import { computeBriefBlocker } from "@/lib/vendor-briefs/document";
import { getVendorBriefContext } from "@/lib/vendor-briefs/repository";

export default async function AssignmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ assignmentId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireStaffSession();
  const [{ assignmentId }, query] = await Promise.all([params, searchParams]);

  const assignment = await getAssignmentDetail(session.organizationId, assignmentId);
  if (!assignment) notFound();

  const timezone = await getOrganizationTimezone(session.organizationId);
  const today = businessToday(timezone);

  const [statuses, history, notes, briefContext, payments, paidMinor] = await Promise.all([
    listProductionStatuses(session.organizationId),
    listStatusHistory(session.organizationId, assignmentId),
    listProductionNotes(session.organizationId, assignmentId),
    getVendorBriefContext(session.organizationId, assignmentId),
    listVendorPayments(session.organizationId, assignmentId),
    sumLiveVendorPaymentsMinor(session.organizationId, assignmentId),
  ]);

  // Receipts are private objects reached through short-lived signed URLs, computed per render rather
  // than stored anywhere a client page could reach.
  const receiptUrlEntries = await Promise.all(
    payments
      .filter((payment) => payment.receiptR2ObjectKey)
      .map(async (payment) => [payment.id, await getSignedPrivateViewUrl(payment.receiptR2ObjectKey as string)] as const),
  );
  const receiptUrlByPaymentId = new Map(receiptUrlEntries);

  const canManage = canManageFinance(session.role);
  const urgency = describeUrgency({ deadline: assignment.deadline, today });
  const position = computeVendorPaymentPosition({
    agreedCostMinor: assignment.agreedVendorCostMinor,
    paidMinor,
  });
  const blocker = briefContext ? computeBriefBlocker(briefContext.sources) : null;
  const returnTo = `/production/${assignmentId}`;

  return (
    <div>
      <Link
        href="/production"
        className="text-sm font-semibold text-[#50586c] underline-offset-4 transition-colors duration-200 hover:text-[#171b36] hover:underline"
      >
        ← Production
      </Link>

      <header className="mt-4 border-b border-[#d9d8d1] pb-8">
        <p className="eyebrow">Vendor assignment</p>
        <h1 className="page-title">{briefContext?.sources.itemLabel ?? briefContext?.sources.itemTypeName ?? "Item"}</h1>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <UrgencyBadge urgency={urgency} deadline={assignment.deadline} />
          <span className="rounded-full border border-[#d9d8d1] bg-[#f6f6f3] px-2.5 py-0.5 text-xs font-semibold text-[#50586c]">
            {assignment.productionStatusName}
          </span>
        </div>
      </header>

      {query.error ? (
        <p className="form-alert mt-6" role="alert">
          {query.error}
        </p>
      ) : null}

      <section className="mt-9 grid gap-10 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-9">
          <div>
            <h2 className="section-title">Vendor</h2>
            {/* Contact details belong here, in the assignment detail — not on every production
                list row, where they would crowd out the operational information. */}
            <dl className="mt-4 grid gap-4 border-y border-[#d9d8d1] py-5 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-[#767b89]">Name</dt>
                <dd className="mt-1 text-[#171b36]">
                  <Link href={`/vendors/${assignment.vendorId}`} className="underline-offset-4 hover:underline">
                    {assignment.vendorName}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-[#767b89]">Phone</dt>
                <dd className="mt-1 text-[#171b36]">{assignment.vendorPhone ?? "Not recorded"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-[#767b89]">Email</dt>
                <dd className="mt-1 text-[#171b36]">{assignment.vendorEmail ?? "Not recorded"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-[#767b89]">Payment position</dt>
                <dd className="mt-1 text-[#171b36]">
                  {position.state === "no_agreed_cost"
                    ? "No agreed cost recorded"
                    : `₦${formatMinorUnits(position.paidMinor)} paid / ₦${formatMinorUnits(position.owedMinor)} owed`}
                </dd>
              </div>
            </dl>
          </div>

          <div>
            <h2 className="section-title">Status history</h2>
            {history.length ? (
              <ol className="mt-4 divide-y divide-[#d9d8d1] border-y border-[#d9d8d1]">
                {history.map((entry) => (
                  <li key={entry.id} className="py-4">
                    <p className="text-sm font-semibold text-[#171b36]">
                      {entry.previousStatusName
                        ? `${entry.previousStatusName} → ${entry.newStatusName}`
                        : `Assigned at ${entry.newStatusName}`}
                    </p>
                    <p className="mt-1 text-xs text-[#767b89]">
                      {entry.changedByName} · {entry.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                    </p>
                    {entry.note ? <p className="mt-2 text-sm leading-6 text-[#50586c]">{entry.note}</p> : null}
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState className="mt-4" title="No history yet" description="Status changes appear here automatically." />
            )}
          </div>

          <div>
            <h2 className="section-title">Vendor payments</h2>
            <p className="mt-2 text-sm text-[#50586c]">
              Balance is the agreed cost minus payments recorded here. Voided payments stop counting
              but stay on the record.
            </p>
            {payments.length ? (
              <ol className="mt-4 divide-y divide-[#d9d8d1] border-y border-[#d9d8d1]">
                {payments.map((payment) => (
                  <li key={payment.id} className="py-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className={`text-sm font-semibold ${payment.voidedAt ? "text-[#767b89] line-through" : "text-[#171b36]"}`}>
                        ₦{formatMinorUnits(payment.amountMinor)}
                      </p>
                      <p className="text-xs text-[#767b89]">
                        {payment.paidOn} · {payment.recordedByName}
                      </p>
                    </div>
                    {payment.reference ? <p className="mt-1 text-sm text-[#50586c]">{payment.reference}</p> : null}
                    {receiptUrlByPaymentId.get(payment.id) ? (
                      <a
                        href={receiptUrlByPaymentId.get(payment.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block text-sm font-semibold text-[#171b36] underline underline-offset-4"
                      >
                        View receipt
                      </a>
                    ) : null}
                    {payment.voidedAt ? (
                      <p className="mt-1 text-xs text-[#8c1d1d]">Voided — {payment.voidReason}</p>
                    ) : canManage ? (
                      <form action={voidVendorPaymentAction} className="mt-3 flex flex-wrap items-end gap-2">
                        <input type="hidden" name="assignmentId" value={assignment.id} />
                        <input type="hidden" name="paymentId" value={payment.id} />
                        <input type="hidden" name="version" value={payment.version} />
                        <label className="form-group flex-1">
                          <span className="text-xs">Void reason</span>
                          <Input name="reason" required placeholder="Why this payment is being reversed" />
                        </label>
                        <Button type="submit" variant="outline">
                          Void
                        </Button>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState
                className="mt-4"
                title="No Vendor payments yet"
                description="Record each payment to this Vendor, with its receipt where you have one."
              />
            )}
          </div>

          <div>
            <h2 className="section-title">Production notes</h2>
            <p className="mt-2 text-sm text-[#50586c]">
              Internal only. These never appear on client pages or in Vendor Brief PDFs.
            </p>
            {notes.length ? (
              <ol className="mt-4 divide-y divide-[#d9d8d1] border-y border-[#d9d8d1]">
                {notes.map((note) => (
                  <li key={note.id} className="py-4">
                    <p className="text-sm leading-6 text-[#272c45]">{note.note}</p>
                    <p className="mt-1 text-xs text-[#767b89]">
                      {note.createdByName} · {note.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState className="mt-4" title="No notes yet" description="Record anything the team should know about this Item's production." />
            )}
          </div>
        </div>

        <aside className="space-y-9">
          <div>
            <h2 className="section-title">Change status</h2>
            <form action={changeProductionStatusAction} className="mt-4 space-y-4 border-t border-[#d9d8d1] pt-5">
              <input type="hidden" name="assignmentId" value={assignment.id} />
              <input type="hidden" name="version" value={assignment.version} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <label className="form-group">
                <span>New status</span>
                <NativeSelect name="newStatusId" defaultValue={assignment.productionStatusId}>
                  {statuses.map((status) => (
                    <option key={status.id} value={status.id}>
                      {status.name}
                    </option>
                  ))}
                </NativeSelect>
              </label>
              <label className="form-group">
                <span>
                  Note <span className="font-normal text-[#50586c]">(optional)</span>
                </span>
                <Input name="note" maxLength={300} />
              </label>
              <Button className="w-full" type="submit">
                Save status
              </Button>
            </form>
          </div>

          <div>
            <h2 className="section-title">Add a production note</h2>
            <form action={addProductionNoteAction} className="mt-4 space-y-4 border-t border-[#d9d8d1] pt-5">
              <input type="hidden" name="assignmentId" value={assignment.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <label className="form-group">
                <span>Note</span>
                <Input name="note" required maxLength={300} />
              </label>
              <Button className="w-full" type="submit" variant="outline">
                Add note
              </Button>
            </form>
          </div>

          {canManage ? (
            <div>
              <h2 className="section-title">Record a Vendor payment</h2>
              <form
                action={recordVendorPaymentAction}
                encType="multipart/form-data"
                className="mt-4 space-y-4 border-t border-[#d9d8d1] pt-5"
              >
                <input type="hidden" name="assignmentId" value={assignment.id} />
                <label className="form-group">
                  <span>Amount (₦)</span>
                  <Input name="amount" required inputMode="decimal" />
                </label>
                <label className="form-group">
                  <span>Paid on</span>
                  <Input type="date" name="paidOn" defaultValue={today} required />
                </label>
                <label className="form-group">
                  <span>
                    Reference <span className="font-normal text-[#50586c]">(optional)</span>
                  </span>
                  <Input name="reference" maxLength={200} />
                </label>
                <label className="form-group">
                  <span>
                    Receipt <span className="font-normal text-[#50586c]">(optional)</span>
                  </span>
                  <input
                    type="file"
                    name="receipt"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className="text-sm text-[#50586c] file:mr-3 file:cursor-pointer file:rounded-[0.6rem] file:border file:border-[#cfcec7] file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-[#171b36]"
                  />
                </label>
                <Button className="w-full" type="submit">
                  Record payment
                </Button>
              </form>
            </div>
          ) : null}

          <div>
            <h2 className="section-title">Vendor Brief</h2>
            <p className="mt-2 text-sm leading-6 text-[#50586c]">
              {assignment.briefLastExportedAt
                ? `Last exported ${assignment.briefLastExportedAt.toISOString().slice(0, 10)}.`
                : "Not exported yet."}
            </p>
            {blocker ? (
              <p className="mt-3 rounded-[0.8rem] border border-[#f0b4b4] bg-[#fdf0f0] px-3 py-2.5 text-sm leading-6 text-[#8c1d1d]">
                Missing required measurements: {blocker.missingLabels.join(", ")}. A Super Admin can
                override with a reason at export.
              </p>
            ) : null}
            <Link
              href={`/production/${assignment.id}/brief`}
              className="mt-4 inline-flex min-h-[2.75rem] w-full cursor-pointer items-center justify-center rounded-[0.8rem] border border-[#171b36] px-4 text-sm font-semibold text-[#171b36] transition-colors duration-200 hover:bg-[#171b36] hover:text-white"
            >
              Build brief
            </Link>
          </div>
        </aside>
      </section>
    </div>
  );
}
