import Link from "next/link";
import { changeProductionStatusAction } from "@/app/actions/vendor-assignments";
import { ProductionClientAccordion } from "@/components/production/client-accordion";
import { UrgencyBadge } from "@/components/production/urgency-badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { NativeSelect } from "@/components/ui/native-select";
import { SortableTableHeader } from "@/components/ui/sortable-table-header";
import { requireStaffSession } from "@/lib/auth/session";
import { businessToday } from "@/lib/domain/business-date";
import { getOrganizationTimezone } from "@/lib/organizations/repository";
import { listProductionStatuses } from "@/lib/production-statuses/repository";
import {
  listProductionWorkspace,
  type ProductionClientGroup,
  type ProductionItemRow,
} from "@/lib/production/workspace-repository";
import { listVendorsWithStats } from "@/lib/vendors/repository";
import { listClientOptions } from "@/lib/clients/repository";

type ProductionSort = "item" | "vendor" | "deadline" | "status";
type SortDirection = "asc" | "desc";

function parseProductionSort(value: string | undefined): ProductionSort {
  return ["item", "vendor", "deadline", "status"].includes(value ?? "") ? (value as ProductionSort) : "deadline";
}

function parseSortDirection(value: string | undefined): SortDirection {
  return value === "desc" ? "desc" : "asc";
}

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
    sort?: string;
    direction?: string;
  }>;
}) {
  const session = await requireStaffSession();
  const params = await searchParams;
  const sort = parseProductionSort(params.sort);
  const direction = parseSortDirection(params.direction);

  const timezone = await getOrganizationTimezone(session.organizationId);
  const today = businessToday(timezone);

  const [productionGroups, statuses, vendors, clients] = await Promise.all([
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
  const groups = sortProductionGroups(productionGroups, sort, direction);
  const returnTo = productionPageHref(params);

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
      <header className="border-b border-kuartz-line pb-8">
        <p className="eyebrow">Operations</p>
        <h1 className="page-title">Production</h1>
        <p className="page-description">
          Track assigned items by client, order, look, vendor, status, and deadline.
        </p>
      </header>

      {params.error ? (
        <p className="form-alert mt-6" role="alert">
          {params.error}
        </p>
      ) : null}

      {/* Filters live in the query string so a filtered view is linkable and survives a reload. */}
      <form className="mt-8 grid gap-3 border-b border-kuartz-line pb-6 md:grid-cols-2 xl:grid-cols-5" role="search">
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="direction" value={direction} />
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
            className="min-h-[3.1rem] w-full rounded-[0.8rem] border border-kuartz-control bg-white/70 px-3.5 py-2.5 text-sm text-kuartz-ink outline-none transition-[border-color,box-shadow,background] focus:border-[#88925f] focus:bg-white focus:ring-4 focus:ring-kuartz-lime/20"
          />
        </label>
        <div className="flex flex-col justify-end gap-3">
          <label className="flex items-center gap-2.5 text-sm font-semibold text-kuartz-body">
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
                className="inline-flex min-h-[2.75rem] items-center px-2 text-sm font-semibold text-kuartz-secondary underline-offset-4 transition-colors duration-200 hover:text-kuartz-ink hover:underline"
              >
                Clear
              </Link>
            ) : null}
          </div>
        </div>
      </form>

      <p className="mt-6 text-sm text-kuartz-secondary" role="status">
        {itemCount} assigned {itemCount === 1 ? "Item" : "Items"}
        {hasFilters ? " matching these filters" : ""}
      </p>

      {groups.length ? (
        <div className="mt-6 space-y-3">
          {groups.map((client) => {
            const clientItems = client.orders.flatMap((order) => order.looks.flatMap((look) => look.items));
            const completedItems = clientItems.filter((item) => item.statusIsCompleted).length;
            const overdueItems = clientItems.filter((item) => !item.statusIsCompleted && item.urgency.band === "overdue").length;

            return (
            <ProductionClientAccordion
              key={client.clientId}
              clientId={client.clientId}
              clientName={client.clientName}
              totalItems={clientItems.length}
              completedItems={completedItems}
              overdueItems={overdueItems}
              defaultOpen={overdueItems > 0}
            >
              <div className="space-y-6">
                {client.orders.map((order) => (
                  <article
                    key={order.orderId}
                    className="rounded-[1rem] border border-kuartz-line bg-white/60 p-4 md:rounded-none md:border-0 md:border-t md:border-kuartz-line md:bg-transparent md:p-0 md:pt-4"
                  >
                    <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <h3 className="text-base font-semibold text-kuartz-ink">
                        <Link href={`/orders/${order.orderId}`} className="underline-offset-4 hover:underline">
                          {order.orderTitle}
                        </Link>
                      </h3>
                    </header>

                    <div className="mt-3 space-y-6">
                      {order.looks.map((look) => (
                        <section key={look.lookId}>
                          <h4 className="border-b border-kuartz-line pb-2 text-xs font-extrabold uppercase tracking-wider text-kuartz-secondary">
                            {look.lookName}
                          </h4>
                          <ul className="divide-y divide-kuartz-line border-b border-kuartz-line xl:hidden">
                            {look.items.map((item) => (
                              <li key={item.assignmentId}>
                                <ProductionItemCard item={item} statuses={statuses} returnTo={returnTo} />
                              </li>
                            ))}
                          </ul>
                          <div className="mt-3 hidden rounded-[0.8rem] border border-kuartz-line xl:block">
                            <table className="w-full table-fixed text-left text-sm">
                              <colgroup>
                                <col className="w-[18%]" />
                                <col className="w-[16%]" />
                                <col className="w-[18%]" />
                                <col className="w-[38%]" />
                                <col className="w-[10%]" />
                              </colgroup>
                              <thead className="bg-[#f4f3f0] text-xs text-kuartz-secondary">
                                <tr>
                                  <th className="py-3 pl-4 pr-4" aria-sort={sort === "item" ? (direction === "asc" ? "ascending" : "descending") : "none"}>
                                    <SortableTableHeader href={productionSortHref(params, "item")} active={sort === "item"} direction={direction}>Item</SortableTableHeader>
                                  </th>
                                  <th className="px-4 py-3" aria-sort={sort === "vendor" ? (direction === "asc" ? "ascending" : "descending") : "none"}>
                                    <SortableTableHeader href={productionSortHref(params, "vendor")} active={sort === "vendor"} direction={direction}>Vendor</SortableTableHeader>
                                  </th>
                                  <th className="px-4 py-3" aria-sort={sort === "deadline" ? (direction === "asc" ? "ascending" : "descending") : "none"}>
                                    <SortableTableHeader href={productionSortHref(params, "deadline")} active={sort === "deadline"} direction={direction}>Deadline</SortableTableHeader>
                                  </th>
                                  <th className="px-4 py-3" aria-sort={sort === "status" ? (direction === "asc" ? "ascending" : "descending") : "none"}>
                                    <SortableTableHeader href={productionSortHref(params, "status")} active={sort === "status"} direction={direction}>Status</SortableTableHeader>
                                  </th>
                                  <th className="px-4 py-3 font-extrabold text-kuartz-ink">Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-kuartz-line bg-white/75">
                                {look.items.map((item) => (
                                  <ProductionItemRow key={item.assignmentId} item={item} statuses={statuses} returnTo={returnTo} />
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </section>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </ProductionClientAccordion>
            );
          })}
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

function ProductionItemCard({
  item,
  statuses,
  returnTo,
}: {
  item: ProductionItemRow;
  statuses: { id: string; name: string }[];
  returnTo: string;
}) {
  return (
    <div className="grid gap-3 py-4">
      <div>
        <p className="font-semibold text-kuartz-ink">
          {item.itemLabel}
          {item.quantity > 1 ? <span className="ml-1.5 font-medium text-kuartz-secondary">×{item.quantity}</span> : null}
        </p>
        <p className="mt-1 text-sm text-kuartz-secondary">
          <Link href={`/vendors/${item.vendorId}`} className="underline-offset-4 hover:underline">
            {item.vendorName}
          </Link>
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <UrgencyBadge urgency={item.urgency} deadline={item.deadline} />
          {item.hasBriefExport ? (
            <span className="text-xs font-medium text-kuartz-muted">Brief exported</span>
          ) : null}
        </div>
      </div>

      <ProductionStatusForm item={item} statuses={statuses} returnTo={returnTo} />
      <Link
        href={`/production/${item.assignmentId}`}
        className="inline-flex min-h-[2.75rem] items-center text-sm font-semibold text-kuartz-secondary underline-offset-4 transition-colors duration-200 hover:text-kuartz-ink hover:underline"
      >
        Open
      </Link>
    </div>
  );
}

function ProductionItemRow({
  item,
  statuses,
  returnTo,
}: {
  item: ProductionItemRow;
  statuses: { id: string; name: string }[];
  returnTo: string;
}) {
  return (
    <tr className="align-middle transition hover:bg-[#fbfaf7]">
      <td className="py-3.5 pl-4 pr-4 font-semibold text-kuartz-ink">
        {item.itemLabel}
        {item.quantity > 1 ? <span className="ml-1.5 font-medium text-kuartz-secondary">x{item.quantity}</span> : null}
      </td>
      <td className="px-4 py-3.5 text-kuartz-secondary">
        <Link href={`/vendors/${item.vendorId}`} className="font-semibold underline-offset-4 hover:underline">
          {item.vendorName}
        </Link>
      </td>
      <td className="px-4 py-3.5"><UrgencyBadge urgency={item.urgency} deadline={item.deadline} /></td>
      <td className="px-4 py-3.5"><ProductionStatusForm item={item} statuses={statuses} returnTo={returnTo} compact /></td>
      <td className="px-4 py-3.5">
        <Link href={`/production/${item.assignmentId}`} className="font-semibold text-kuartz-ink underline-offset-4 hover:underline">
          Open
        </Link>
      </td>
    </tr>
  );
}

function ProductionStatusForm({
  item,
  statuses,
  returnTo,
  compact = false,
}: {
  item: ProductionItemRow;
  statuses: { id: string; name: string }[];
  returnTo: string;
  compact?: boolean;
}) {
  return (
    <form action={changeProductionStatusAction} className="flex min-w-0 flex-wrap items-end gap-2">
      <input type="hidden" name="assignmentId" value={item.assignmentId} />
      <input type="hidden" name="version" value={item.assignmentVersion} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <label className={`form-group flex-1 ${compact ? "min-w-0" : "min-w-[10rem]"}`}>
        <span className="sr-only">Status for {item.itemLabel}</span>
        <NativeSelect
          name="newStatusId"
          defaultValue={item.statusId}
          aria-label={`Status for ${item.itemLabel}`}
          submitOnChange
        >
          {statuses.map((status) => <option key={status.id} value={status.id}>{status.name}</option>)}
        </NativeSelect>
      </label>
    </form>
  );
}

function sortProductionGroups(
  groups: ProductionClientGroup[],
  sort: ProductionSort,
  direction: SortDirection,
): ProductionClientGroup[] {
  return groups.map((client) => ({
    ...client,
    orders: client.orders.map((order) => ({
      ...order,
      looks: order.looks.map((look) => ({
        ...look,
        items: [...look.items].sort((left, right) => {
          let result = 0;
          if (sort === "item") result = left.itemLabel.localeCompare(right.itemLabel);
          if (sort === "vendor") result = left.vendorName.localeCompare(right.vendorName);
          if (sort === "deadline") result = left.deadline.localeCompare(right.deadline);
          if (sort === "status") result = left.statusName.localeCompare(right.statusName);
          if (result === 0) result = left.itemLabel.localeCompare(right.itemLabel);
          return direction === "asc" ? result : -result;
        }),
      })),
    })),
  }));
}

function productionSortHref(
  params: {
    vendorId?: string;
    statusId?: string;
    clientId?: string;
    dueBefore?: string;
    overdue?: string;
    sort?: string;
    direction?: string;
  },
  sort: ProductionSort,
): string {
  const query = new URLSearchParams();
  const currentSort = parseProductionSort(params.sort);
  const currentDirection = parseSortDirection(params.direction);
  const nextDirection: SortDirection = currentSort === sort && currentDirection === "asc" ? "desc" : "asc";
  if (params.vendorId) query.set("vendorId", params.vendorId);
  if (params.statusId) query.set("statusId", params.statusId);
  if (params.clientId) query.set("clientId", params.clientId);
  if (params.dueBefore) query.set("dueBefore", params.dueBefore);
  if (params.overdue === "1") query.set("overdue", "1");
  query.set("sort", sort);
  query.set("direction", nextDirection);
  return `/production?${query.toString()}`;
}

function productionPageHref(params: {
  vendorId?: string;
  statusId?: string;
  clientId?: string;
  dueBefore?: string;
  overdue?: string;
  sort?: string;
  direction?: string;
}): string {
  const query = new URLSearchParams();
  if (params.vendorId) query.set("vendorId", params.vendorId);
  if (params.statusId) query.set("statusId", params.statusId);
  if (params.clientId) query.set("clientId", params.clientId);
  if (params.dueBefore) query.set("dueBefore", params.dueBefore);
  if (params.overdue === "1") query.set("overdue", "1");
  query.set("sort", parseProductionSort(params.sort));
  query.set("direction", parseSortDirection(params.direction));
  return `/production?${query.toString()}`;
}
