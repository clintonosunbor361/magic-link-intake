import Link from "next/link";
import { notFound } from "next/navigation";
import { createInvoiceAction, updateInvoiceAction, voidInvoiceAction } from "@/app/actions/invoices";
import {
  editClientPaymentAction,
  recordClientPaymentAction,
  voidClientPaymentAction,
} from "@/app/actions/payments";
import { SendInvoiceButton } from "@/components/finance/send-invoice-button";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { requireStaffSession } from "@/lib/auth/session";
import { businessToday } from "@/lib/domain/business-date";
import { canManageFinance } from "@/lib/domain/access-control";
import { computeOrderBalance } from "@/lib/finance/balances";
import {
  computeLineAmountMinor,
  deriveInvoiceStatus,
  detectPaymentMismatches,
  INVOICE_STATUS_LABELS,
} from "@/lib/finance/invoice";
import { getInvoiceForOrder } from "@/lib/finance/repository";
import { formatMinorUnits } from "@/lib/forms/money";
import { getOrderWithLooksAndItems } from "@/lib/orders/repository";
import { getOrganizationTimezone } from "@/lib/organizations/repository";

const BLANK_LINE_ROWS = 4;
const textareaClass =
  "min-h-[3.5rem] w-full rounded-[0.8rem] border border-kuartz-control bg-white/70 px-3.5 py-3 text-sm text-kuartz-ink outline-none focus:border-[#88925f] focus:bg-white focus:ring-4 focus:ring-kuartz-lime/20";

export default async function OrderInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireStaffSession();
  const [{ id }, query] = await Promise.all([params, searchParams]);

  const order = await getOrderWithLooksAndItems(session.organizationId, id);
  if (!order) notFound();

  const [invoice, timezone] = await Promise.all([
    getInvoiceForOrder(session.organizationId, id),
    getOrganizationTimezone(session.organizationId),
  ]);
  const today = businessToday(timezone);
  const canManage = canManageFinance(session.role);

  const balance = computeOrderBalance({
    invoicedMinor: invoice ? invoice.totalMinor : null,
    paidMinor: invoice?.paidMinor ?? 0,
  });
  const status = invoice ? deriveInvoiceStatus({ lifecycle: invoice.lifecycle, balance }) : null;
  const mismatches = invoice ? detectPaymentMismatches({ lifecycle: invoice.lifecycle, balance }) : [];
  const editable = invoice?.lifecycle === "draft";

  return (
    <div>
      <Link
        href={`/orders/${id}`}
        className="text-sm font-semibold text-kuartz-secondary underline-offset-4 transition-colors duration-200 hover:text-kuartz-ink hover:underline"
      >
        ← {order.title}
      </Link>

      <header className="mt-4 border-b border-kuartz-line pb-8">
        <p className="eyebrow">Invoice</p>
        <h1 className="page-title">{invoice ? invoice.invoiceNumber : "Create the Invoice"}</h1>
        <p className="page-description">
          One Invoice per Order. Line items are entered by hand, totals are calculated, and the PDF is
          generated fresh when you send it — nothing is stored.
        </p>
        {status ? (
          <p className="mt-4">
            <span className="rounded-full border border-kuartz-line bg-[#f6f6f3] px-2.5 py-0.5 text-xs font-semibold text-kuartz-secondary">
              {INVOICE_STATUS_LABELS[status]}
            </span>
          </p>
        ) : null}
      </header>

      {query.error ? (
        <p className="form-alert mt-6" role="alert">
          {query.error}
        </p>
      ) : null}

      {!canManage ? (
        <p className="mt-6 border-l-[3px] border-[#88925f] bg-white/70 px-4 py-3.5 text-sm leading-6 text-[#3f4a24]" role="status">
          Invoices and payments are managed by a Super Admin. You can see the position here but cannot
          change it.
        </p>
      ) : null}

      {mismatches.length ? (
        <div className="mt-6 space-y-2">
          {mismatches.map((mismatch) => (
            <p
              key={mismatch.kind}
              className="rounded-[0.8rem] border border-[#f0b4b4] bg-[#fdf0f0] px-3 py-2.5 text-sm leading-6 text-[#8c1d1d]"
              role="alert"
            >
              {mismatch.kind === "overpaid"
                ? `Overpaid by ₦${formatMinorUnits(mismatch.excessMinor)}. Check the payment records against what the client actually sent.`
                : mismatch.kind === "paid_against_void"
                  ? "Payments are recorded against a voided Invoice. Reissue or reverse them so the records agree."
                  : "Payments are recorded against a Draft Invoice that has never been sent."}
            </p>
          ))}
        </div>
      ) : null}

      {invoice ? (
        <section className="mt-9 grid gap-10 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-9">
            <div>
              <h2 className="section-title">Line items</h2>
              {editable && canManage ? (
                <form action={updateInvoiceAction} className="mt-4 space-y-4 border-y border-kuartz-line py-5">
                  <input type="hidden" name="orderId" value={id} />
                  <input type="hidden" name="invoiceId" value={invoice.id} />
                  <input type="hidden" name="version" value={invoice.version} />
                  <InvoiceFields
                    issueDate={invoice.issueDate}
                    dueDate={invoice.dueDate}
                    notes={invoice.notes}
                    paymentInstructions={invoice.paymentInstructions}
                    lines={invoice.lines}
                  />
                  <Button type="submit" variant="outline">
                    Save Invoice
                  </Button>
                </form>
              ) : (
                <div className="mt-4 border-y border-kuartz-line py-2">
                  {invoice.lines.map((line) => (
                    <div key={line.id} className="grid grid-cols-[1fr_auto] gap-4 py-3 text-sm">
                      <div>
                        <p className="text-kuartz-ink">{line.description}</p>
                        <p className="mt-1 text-xs text-kuartz-muted">
                          {line.quantity} × ₦{formatMinorUnits(line.unitPriceMinor)}
                        </p>
                      </div>
                      <p className="font-semibold text-kuartz-ink">₦{formatMinorUnits(computeLineAmountMinor(line))}</p>
                    </div>
                  ))}
                </div>
              )}

              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-kuartz-secondary">Total invoiced</dt>
                  <dd className="font-semibold text-kuartz-ink">₦{formatMinorUnits(invoice.totalMinor)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-kuartz-secondary">Paid</dt>
                  <dd className="text-kuartz-ink">₦{formatMinorUnits(invoice.paidMinor)}</dd>
                </div>
                <div className="flex justify-between border-t border-kuartz-line pt-2">
                  <dt className="font-semibold text-kuartz-ink">Balance</dt>
                  <dd className="font-semibold text-kuartz-ink">
                    ₦{formatMinorUnits(balance.state === "invoiced" ? balance.balanceMinor : 0)}
                  </dd>
                </div>
              </dl>
            </div>

            <div>
              <h2 className="section-title">Client payments</h2>
              {invoice.payments.length ? (
                <ol className="mt-4 divide-y divide-kuartz-line border-y border-kuartz-line">
                  {invoice.payments.map((payment) => (
                    <li key={payment.id} className="py-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className={`text-sm font-semibold ${payment.voidedAt ? "text-kuartz-muted line-through" : "text-kuartz-ink"}`}>
                          ₦{formatMinorUnits(payment.amountMinor)}
                        </p>
                        <p className="text-xs text-kuartz-muted">
                          {payment.paidOn} · {payment.recordedByName}
                        </p>
                      </div>
                      {payment.reference ? (
                        <p className="mt-1 text-sm text-kuartz-secondary">{payment.reference}</p>
                      ) : null}
                      {payment.voidedAt ? (
                        <p className="mt-1 text-xs text-[#8c1d1d]">Voided — {payment.voidReason}</p>
                      ) : canManage ? (
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <form action={editClientPaymentAction} className="flex flex-wrap items-end gap-2">
                            <input type="hidden" name="orderId" value={id} />
                            <input type="hidden" name="paymentId" value={payment.id} />
                            <input type="hidden" name="version" value={payment.version} />
                            <label className="form-group w-28">
                              <span className="text-xs">Amount (₦)</span>
                              <Input name="amount" defaultValue={formatMinorUnits(payment.amountMinor)} required />
                            </label>
                            <label className="form-group w-36">
                              <span className="text-xs">Paid on</span>
                              <Input type="date" name="paidOn" defaultValue={payment.paidOn} required />
                            </label>
                            <input type="hidden" name="reference" value={payment.reference} />
                            <Button type="submit" variant="outline">
                              Save
                            </Button>
                          </form>
                          <form action={voidClientPaymentAction} className="flex flex-wrap items-end gap-2">
                            <input type="hidden" name="orderId" value={id} />
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
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ol>
              ) : (
                <EmptyState
                  className="mt-4"
                  title="No payments recorded"
                  description="Record each payment as it arrives. The balance updates automatically."
                />
              )}
            </div>
          </div>

          <aside className="space-y-9">
            {canManage ? (
              <>
                <div>
                  <h2 className="section-title">Record a payment</h2>
                  <form action={recordClientPaymentAction} className="mt-4 space-y-4 border-t border-kuartz-line pt-5">
                    <input type="hidden" name="orderId" value={id} />
                    <input type="hidden" name="invoiceId" value={invoice.id} />
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
                        Reference <span className="font-normal text-kuartz-secondary">(optional)</span>
                      </span>
                      <Input name="reference" maxLength={200} />
                    </label>
                    <Button className="w-full" type="submit">
                      Record payment
                    </Button>
                  </form>
                </div>

                {invoice.lifecycle !== "void" ? (
                  <div>
                    <h2 className="section-title">Send</h2>
                    <p className="mt-2 text-sm leading-6 text-kuartz-secondary">
                      {invoice.sentAt
                        ? `Sent ${invoice.sentAt.toISOString().slice(0, 10)}.`
                        : "Sending generates the PDF and marks this Invoice Sent in the same step."}
                    </p>
                    {!invoice.sentAt ? <SendInvoiceButton invoiceId={invoice.id} /> : null}
                  </div>
                ) : null}

                {invoice.lifecycle !== "void" ? (
                  <div>
                    <h2 className="section-title">Void</h2>
                    <form action={voidInvoiceAction} className="mt-4 space-y-4 border-t border-kuartz-line pt-5">
                      <input type="hidden" name="orderId" value={id} />
                      <input type="hidden" name="invoiceId" value={invoice.id} />
                      <input type="hidden" name="version" value={invoice.version} />
                      <label className="form-group">
                        <span>Reason</span>
                        <Input name="reason" required placeholder="Why this Invoice is being voided" />
                      </label>
                      <Button className="w-full" type="submit" variant="outline">
                        Void Invoice
                      </Button>
                    </form>
                  </div>
                ) : (
                  <p className="rounded-[0.8rem] border border-kuartz-line bg-[#f6f6f3] px-3 py-2.5 text-sm leading-6 text-kuartz-secondary">
                    Voided {invoice.voidedAt?.toISOString().slice(0, 10)} — {invoice.voidReason}
                  </p>
                )}
              </>
            ) : null}
          </aside>
        </section>
      ) : canManage ? (
        <section className="mt-9 max-w-3xl">
          <form action={createInvoiceAction} className="space-y-4 border-y border-kuartz-line py-5">
            <input type="hidden" name="orderId" value={id} />
            <InvoiceFields issueDate={today} dueDate={null} notes="" paymentInstructions="" lines={[]} />
            <Button type="submit">Create Invoice</Button>
          </form>
        </section>
      ) : (
        <EmptyState
          className="mt-9"
          title="No Invoice yet"
          description="A Super Admin creates the Invoice for this Order."
        />
      )}
    </div>
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
  // Existing lines plus spare blanks: a blank row is dropped server-side, so the form never needs
  // client-side row management to add one more item.
  const rows = [
    ...lines.map((line) => ({
      description: line.description,
      quantity: String(line.quantity),
      unitPrice: formatMinorUnits(line.unitPriceMinor),
    })),
    ...Array.from({ length: BLANK_LINE_ROWS }, () => ({ description: "", quantity: "", unitPrice: "" })),
  ];

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="form-group">
          <span>Issue date</span>
          <Input type="date" name="issueDate" defaultValue={issueDate} required />
        </label>
        <label className="form-group">
          <span>
            Due date <span className="font-normal text-kuartz-secondary">(optional)</span>
          </span>
          <Input type="date" name="dueDate" defaultValue={dueDate ?? ""} />
        </label>
      </div>

      <fieldset>
        <legend className="text-sm font-semibold text-kuartz-body">Line items</legend>
        <div className="mt-3 space-y-3">
          {rows.map((row, index) => (
            <div key={index} className="grid gap-3 sm:grid-cols-[1fr_5rem_8rem]">
              <label className="form-group">
                <span className="sr-only">Description</span>
                <Input name="lineDescription" defaultValue={row.description} placeholder="Description" />
              </label>
              <label className="form-group">
                <span className="sr-only">Quantity</span>
                <Input name="lineQuantity" defaultValue={row.quantity} placeholder="Qty" inputMode="numeric" />
              </label>
              <label className="form-group">
                <span className="sr-only">Unit price</span>
                <Input name="lineUnitPrice" defaultValue={row.unitPrice} placeholder="Unit price (₦)" inputMode="decimal" />
              </label>
            </div>
          ))}
        </div>
      </fieldset>

      <label className="form-group">
        <span>
          Payment instructions <span className="font-normal text-kuartz-secondary">(optional)</span>
        </span>
        <textarea name="paymentInstructions" defaultValue={paymentInstructions} className={textareaClass} />
      </label>
      <label className="form-group">
        <span>
          Notes <span className="font-normal text-kuartz-secondary">(optional)</span>
        </span>
        <textarea name="notes" defaultValue={notes} className={textareaClass} />
      </label>
    </>
  );
}
