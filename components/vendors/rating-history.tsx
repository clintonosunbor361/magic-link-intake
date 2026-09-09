import Link from "next/link";
import type { listVendorRatingHistory } from "@/lib/vendors/rating-repository";

type RatingHistory = Awaited<ReturnType<typeof listVendorRatingHistory>>;
const dateFormatter = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" });

export function RatingHistory({ ratings }: { ratings: RatingHistory }) {
  return <section>
    <h2 className="section-title">Rating history</h2>
    {!ratings.length ? <p className="mt-3 text-sm text-kuartz-muted">No saved ratings yet.</p> :
      <ol className="mt-4 divide-y divide-kuartz-line">
        {ratings.map((rating) => <li key={rating.id} className="py-4 text-sm">
          <Link className="font-semibold underline" href={`/orders/${rating.orderId}/vendor-ratings`}>{rating.orderTitle}</Link>
          <p>{rating.clientName} · {rating.assignmentId ? `${rating.lookName} · ${rating.itemLabel}` : "Legacy Order rating"}</p>
          <p className="mt-2">Quality {rating.quality}/5 · Timeliness {rating.timeliness}/5 · Communication {rating.communication}/5</p>
          <p className="mt-1 text-kuartz-muted">{rating.ratedBy} · {dateFormatter.format(rating.createdAt)}{rating.archivedAt ? " · Archived" : ""}</p>
          {rating.revisions.length ? <details className="mt-2">
            <summary className="cursor-pointer font-medium">Score revisions ({rating.revisions.length})</summary>
            <ol className="mt-2 space-y-2">{rating.revisions.map((revision) => <li key={revision.id}>
              <p>Quality {revision.previousQuality} → {revision.newQuality}; Timeliness {revision.previousTimeliness} → {revision.newTimeliness}; Communication {revision.previousCommunication} → {revision.newCommunication}</p>
              <p className="text-kuartz-muted">{revision.changedBy} · {dateFormatter.format(revision.createdAt)}</p>
            </li>)}</ol>
          </details> : null}
        </li>)}
      </ol>}
  </section>;
}
