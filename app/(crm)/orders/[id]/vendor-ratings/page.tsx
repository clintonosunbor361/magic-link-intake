import Link from "next/link";
import { notFound } from "next/navigation";
import { rateVendorAction } from "@/app/actions/vendor-ratings";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { NativeSelect } from "@/components/ui/native-select";
import { requireStaffSession } from "@/lib/auth/session";
import { getOrderWithLooksAndItems } from "@/lib/orders/repository";
import { listOrderVendorsForRating } from "@/lib/vendors/rating-repository";
import { MAX_RATING_SCORE, MIN_RATING_SCORE, RATING_CRITERIA } from "@/lib/vendors/ratings";

const CRITERION_LABELS: Record<(typeof RATING_CRITERIA)[number], string> = {
  quality: "Quality",
  timeliness: "Timeliness",
  communication: "Communication",
};

const SCORES = Array.from({ length: MAX_RATING_SCORE - MIN_RATING_SCORE + 1 }, (_, i) => MIN_RATING_SCORE + i);

export default async function OrderVendorRatingsPage({
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

  const vendorRows = await listOrderVendorsForRating(session.organizationId, id);

  return (
    <div>
      <Link
        href={`/orders/${id}`}
        className="text-sm font-semibold text-kuartz-secondary underline-offset-4 transition-colors duration-200 hover:text-kuartz-ink hover:underline"
      >
        ← {order.title}
      </Link>

      <header className="mt-4 border-b border-kuartz-line pb-8">
        <p className="eyebrow">Vendor ratings</p>
        <h1 className="page-title">Rate the Vendors</h1>
        <p className="page-description">
          One rating per Vendor on this Order, scored out of 5 on each criterion. The overall score
          is the average of the three. Ratings can be revised later, and every change keeps a record.
        </p>
      </header>

      {query.error ? (
        <p className="form-alert mt-6" role="alert">
          {query.error}
        </p>
      ) : null}

      {vendorRows.length ? (
        <section className="mt-9 space-y-8">
          {vendorRows.map((row) => (
            <form
              key={row.vendorId}
              action={rateVendorAction}
              aria-label={`Rate ${row.vendorName}`}
              className="border-t border-kuartz-line pt-6"
            >
              <input type="hidden" name="orderId" value={id} />
              <input type="hidden" name="vendorId" value={row.vendorId} />
              {row.ratingVersion !== null ? (
                <input type="hidden" name="ratingVersion" value={row.ratingVersion} />
              ) : null}

              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="section-title">
                  <Link href={`/vendors/${row.vendorId}`} className="underline-offset-4 hover:underline">
                    {row.vendorName}
                  </Link>
                </h2>
                <p className="text-sm text-kuartz-muted">{row.ratingId ? "Rated — editing revises it" : "Not rated yet"}</p>
              </div>

              <div className="mt-4 flex flex-wrap items-end gap-4">
                {RATING_CRITERIA.map((criterion) => (
                  <label key={criterion} className="form-group w-40">
                    <span>{CRITERION_LABELS[criterion]}</span>
                    <NativeSelect
                      name={criterion}
                      defaultValue={String(row[criterion] ?? 3)}
                      aria-label={`${CRITERION_LABELS[criterion]} for ${row.vendorName}`}
                    >
                      {SCORES.map((score) => (
                        <option key={score} value={score}>
                          {score} / {MAX_RATING_SCORE}
                        </option>
                      ))}
                    </NativeSelect>
                  </label>
                ))}
                <Button type="submit" variant="outline">
                  {row.ratingId ? "Save revision" : "Save rating"}
                </Button>
              </div>
            </form>
          ))}
        </section>
      ) : (
        <EmptyState
          className="mt-9"
          title="No Vendors on this Order yet"
          description="Assign a Vendor to at least one Item before rating anyone."
        />
      )}
    </div>
  );
}
