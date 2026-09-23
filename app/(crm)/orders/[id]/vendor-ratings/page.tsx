import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { EmptyState } from "@/components/ui/empty-state";
import { VendorRatingForm } from "@/components/vendors/vendor-rating-form";
import { requireStaffSession } from "@/lib/auth/session";
import { getOrderWithLooksAndItems } from "@/lib/orders/repository";
import { listOrderVendorsForRating } from "@/lib/vendors/rating-repository";

export default async function OrderVendorRatingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; from?: string }>;
}) {
  const session = await requireStaffSession();
  const [{ id }, query] = await Promise.all([params, searchParams]);

  const order = await getOrderWithLooksAndItems(session.organizationId, id);
  if (!order) notFound();

  const vendorRows = await listOrderVendorsForRating(session.organizationId, id);

  return (
    <div>
      <Breadcrumbs items={[{ label: "Orders", href: "/orders" }, { label: order.title, href: `/orders/${id}` }, { label: "Vendor ratings" }]} />

      <header className="mt-4 border-b border-kuartz-line pb-8">
        <p className="eyebrow">Vendor ratings</p>
        <h1 className="page-title">Rate the Vendors</h1>
        <p className="page-description">
          One rating per Item assignment on this Order, scored out of 5 on each criterion. The overall score
          is the average of the three. Ratings can be revised later, and every change keeps a record.
        </p>
      </header>

      {query.error ? (
        <p className="form-alert mt-6" role="alert">
          {query.error}
        </p>
      ) : null}
      {query.from === "completion" ? <div className="form-success mt-6 flex flex-wrap items-center justify-between gap-3"><span>Order completed. Vendor ratings are optional and can be finished now or later.</span><Link href={`/orders/${id}`} className="font-semibold underline">Skip for now</Link></div> : null}

      {vendorRows.length ? (
        <section className="mt-9 space-y-8">
          {vendorRows.map((row) => (
            <VendorRatingForm
              key={row.assignmentId}
              orderId={id}
              row={row}
            />
          ))}
        </section>
      ) : (
        <EmptyState
          className="mt-9"
          title="No completed assignments to rate"
          description="Complete production or the Order to rate its assignments."
        />
      )}
    </div>
  );
}
