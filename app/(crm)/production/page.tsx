import Link from "next/link";
import { changeProductionStatusAction } from "@/app/actions/vendor-assignments";
import { UrgencyBadge } from "@/components/production/urgency-badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { NativeSelect } from "@/components/ui/native-select";
import { requireStaffSession } from "@/lib/auth/session";
import { businessToday } from "@/lib/domain/business-date";
import { formatMinorUnits } from "@/lib/forms/money";
import { getOrganizationTimezone } from "@/lib/organizations/repository";
import { listProductionStatuses } from "@/lib/production-statuses/repository";
import { listProductionWorkspace, type ProductionItemRow } from "@/lib/production/workspace-repository";
import { listVendorsWithStats } from "@/lib/vendors/repository";
import { listClientOptions } from "@/lib/clients/repository";

export default async function ProductionPage({
  searchParams,
}: {
  searchParams: Promise<{
    vendorId?: string;
    statusId?: string;
    clientId?: string;
    dueBefore?: string;
    overdue?: string;
    error?: string;
  }>;
}) {
  const session = await requireStaffSession();
  const params = await searchParams;

  const timezone = await getOrganizationTimezone(session.organizationId);
  const today = businessToday(timezone);

  const [groups, statuses, vendors, clients] = await Promise.all([
    listProductionWorkspace({
      organizationId: session.organizationId,
      today,
      filters: {
        vendorId: params.vendorId || undefined,
        statusId: params.statusId || undefined,
        clientId: params.clientId || undefined,
        dueBefore: params.dueBefore || undefined,
        overdueOnly: params.overdue === "1",
      },
    }),
    listProductionStatuses(session.organizationId),
    listVendorsWithStats(session.organizationId),
    listClientOptions(session.organizationId),
  ]);

  const hasFilters = Boolean(
    params.vendorId || params.statusId || params.clientId || params.dueBefore || params.overdue === "1",
  );
  const itemCount = groups.reduce(
    (total, client) =>
      total + client.orders.reduce((sum, order) => sum + order.looks.reduce((n, look) => n + look.items.length, 0), 0),
    0,
  );

  return (
    <div>
      <header className="border-b border-[#d9d8d1] pb-8">
        <p className="eyebrow">Operations</p>
        <h1 className="page-title">Production</h1>
        <p className="page-description">
          Every assigned Item, grouped by Client, Order and Look. Urgency comes from the deadline —
          there is no manual priority to keep in sync.
        </p>
      </header>

      {params.error ? (
        <p className="form-alert mt-6" role="alert">
          {params.error}
        </p>
      ) : null}

      {/* Filters live in the query string so a filtered view is linkable and survives a reload. */}
      <form className="mt-8 grid gap-3 border-b border-[#d9d8d1] pb-6 md:grid-cols-2 xl:grid-cols-5" role="search">
        <label className="form-group">
          <span>Vendor</span>
          <NativeSelect name="vendorId" defaultValue={params.vendorId ?? ""}>
            <option value="">All Vendors</option>
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="form-group">
          <span>Status</span>
          <NativeSelect name="statusId" defaultValue={params.statusId ?? ""}>
            <option value="">All statuses</option>
            {statuses.map((status) => (
              <option key={status.id} value={status.id}>
                {status.name}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="form-group">
          <span>Client</span>
          <NativeSelect name="clientId" defaultValue={params.clientId ?? ""}>
            <option value="">All Clients</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.fullName}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="form-group">
          <span>Due before</span>
          <input
            type="date"
            name="dueBefore"
            defaultValue={params.dueBefore ?? ""}
            className="min-h-[3.1rem] w-full rounded-[0.8rem] border border-[#cfcec7] bg-white/70 px-3.5 py-2.5 text-sm text-[#171b36] outline-none transition-[border-color,box-shadow,background] focus:border-[#88925f] focus:bg-white focus:ring-4 focus:ring-[#d2ff67]/20"
          />
        </label>
        <div className="flex flex-col justify-end gap-3">
          <label className="flex items-center gap-2.5 text-sm font-semibold text-[#272c45]">
            <input
              type="checkbox"
              name="overdue"
              value="1"
              defaultChecked={params.overdue === "1"}
              className="h-4 w-4 cursor-pointer accent-[#88925f]"
            />
            Overdue only
          </label>
          <div className="flex gap-2">
            <Button type="submit" variant="outline" className="flex-1">
              Apply
            </Button>
            {hasFilters ? (
              <Link
                href="/production"
                className="inline-flex min-h-[2.75rem] items-center px-2 text-sm font-semibold text-[#50586c] underline-offset-4 transition-colors duration-200 hover:text-[#171b36] hover:underline"
              >
                Clear
              </Link>
            ) : null}
          </div>
        </div>
      </form>

      <p className="mt-6 text-sm text-[#50586c]" role="status">
        {itemCount} assigned {itemCount === 1 ? "Item" : "Items"}
        {hasFilters ? " matching these filters" : ""} · today is {today} ({timezone})
      </p>

      {groups.length ? (
        <div className="mt-6 space-y-10">
          {groups.map((client) => (
            <section key={client.clientId} aria-label={client.clientName}>
              {/* Client is a heading on desktop; on mobile it also appears in each Order card
                  header, since the two-level layout drops this level of indentation. */}
              <h2 className="sticky top-0 z-10 hidden border-b border-[#171b36] bg-[#f7f8fb]/95 py-2 text-lg font-bold tracking-tight text-[#171b36] backdrop-blur md:block">
                <Link href={`/clients/${client.clientId}`} className="underline-offset-4 hover:underline">
                  {client.clientName}
                </Link>
              </h2>

              <div className="mt-4 space-y-6">
                {client.orders.map((order) => (
                  <article
                    key={order.orderId}
                    className="rounded-[1rem] border border-[#d9d8d1] bg-white/60 p-4 md:rounded-none md:border-0 md:border-t md:border-[#d9d8d1] md:bg-transparent md:p-0 md:pt-4"
                  >
                    <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <h3 className="text-base font-semibold text-[#171b36]">
                        <Link href={`/orders/${order.orderId}`} className="underline-offset-4 hover:underline">
                          {order.orderTitle}
                        </Link>
                        <span className="ml-2 text-sm font-medium text-[#50586c] md:hidden">
                          {order.clientName}
                        </span>
                      </h3>
                      {/* Client payment position sits at Order level, never on every Item row. */}
                      <p className="text-sm text-[#50586c]">
                        {order.orderBalance.state === "not_invoiced"
                          ? "Not invoiced yet"
                          : `Balance ₦${formatMinorUnits(order.orderBalance.balanceMinor)}`}
                      </p>
                    </header>

                    <div className="mt-3 space-y-5">
                      {order.looks.map((look) => (
                        <div key={look.lookId}>
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-[#767b89]">
                            {look.lookName}
                          </h4>
                          <ul className="mt-2 divide-y divide-[#e6e5df] border-t border-[#e6e5df]">
                            {look.items.map((item) => (
                              <li key={item.assignmentId}>
                                <ProductionItem item={item} statuses={statuses} />
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState
          className="mt-8"
          title={hasFilters ? "No Items match these filters" : "Nothing in production yet"}
          description={
            hasFilters
              ? "Clear a filter to widen the view. Archived assignments from a reassignment are never listed here."
              : "Assign a Vendor to an Item from its Order to start tracking production."
          }
        />
      )}
    </div>
  );
}

function ProductionItem({
  item,
  statuses,
}: {
  item: ProductionItemRow;
  statuses: { id: string; name: string }[];
}) {
  return (
    <div className="grid gap-3 py-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start lg:gap-6">
      <div>
        <p className="font-semibold text-[#171b36]">
          {item.itemLabel}
          {item.quantity > 1 ? <span className="ml-1.5 font-medium text-[#50586c]">×{item.quantity}</span> : null}
        </p>
        <p className="mt-1 text-sm text-[#50586c]">
          <Link href={`/vendors/${item.vendorId}`} className="underline-offset-4 hover:underline">
            {item.vendorName}
          </Link>
          {" · "}
          {/* Compact vendor payment position; the full picture lives in the assignment drawer. */}
          {item.vendorPosition.state === "no_agreed_cost"
            ? "No agreed cost"
            : `₦${formatMinorUnits(item.vendorPosition.paidMinor)} paid / ₦${formatMinorUnits(item.vendorPosition.owedMinor)} owed`}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <UrgencyBadge urgency={item.urgency} deadline={item.deadline} />
          {item.hasBriefExport ? (
            <span className="text-xs font-medium text-[#767b89]">Brief exported</span>
          ) : null}
        </div>
      </div>

      <form action={changeProductionStatusAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="assignmentId" value={item.assignmentId} />
        <input type="hidden" name="version" value={item.assignmentVersion} />
        <input type="hidden" name="returnTo" value="/production" />
        <label className="form-group min-w-[10rem] flex-1">
          <span className="sr-only">Status for {item.itemLabel}</span>
          <NativeSelect name="newStatusId" defaultValue={item.statusId} aria-label={`Status for ${item.itemLabel}`}>
            {statuses.map((status) => (
              <option key={status.id} value={status.id}>
                {status.name}
              </option>
            ))}
          </NativeSelect>
        </label>
        <Button type="submit" variant="outline" aria-label={`Update status for ${item.itemLabel}`}>
          Update
        </Button>
        <Link
          href={`/production/${item.assignmentId}`}
          className="inline-flex min-h-[2.75rem] items-center text-sm font-semibold text-[#50586c] underline-offset-4 transition-colors duration-200 hover:text-[#171b36] hover:underline"
        >
          Open
        </Link>
      </form>
    </div>
  );
}
