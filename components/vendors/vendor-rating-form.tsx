import Link from "next/link";
import { rateVendorAction } from "@/app/actions/vendor-ratings";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { MAX_RATING_SCORE, MIN_RATING_SCORE, RATING_CRITERIA } from "@/lib/vendors/ratings";

const CRITERION_LABELS: Record<(typeof RATING_CRITERIA)[number], string> = {
  quality: "Quality",
  timeliness: "Timeliness",
  communication: "Communication",
};

const SCORES = Array.from({ length: MAX_RATING_SCORE - MIN_RATING_SCORE + 1 }, (_, i) => MIN_RATING_SCORE + i);

export type VendorRatingRow = {
  assignmentId: string;
  vendorId: string;
  vendorName: string;
  lookName: string;
  itemLabel: string;
  ratingId: string | null;
  ratingVersion: number | null;
  quality: number | null;
  timeliness: number | null;
  communication: number | null;
};

export function VendorRatingForm({ orderId, row }: { orderId: string; row: VendorRatingRow }) {
  return (
    <form
      action={rateVendorAction}
      aria-label={`Rate ${row.vendorName} for ${row.lookName} - ${row.itemLabel}`}
      className="border-t border-kuartz-line pt-6"
    >
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="vendorId" value={row.vendorId} />
      <input type="hidden" name="assignmentId" value={row.assignmentId} />
      {row.ratingVersion !== null ? (
        <input type="hidden" name="ratingVersion" value={row.ratingVersion} />
      ) : null}

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="section-title">
          <Link href={`/vendors/${row.vendorId}`} className="underline-offset-4 hover:underline">
            {row.vendorName}
          </Link>
          <span className="block text-sm font-normal">{row.lookName} - {row.itemLabel || "Item assignment"}</span>
        </h2>
        <p className="text-sm text-kuartz-muted">{row.ratingId ? "Rated. Editing updates it." : "Not rated yet"}</p>
      </div>

      <div
        data-testid="rating-controls"
        className="mt-4 grid grid-cols-1 items-end gap-4 sm:grid-cols-2 xl:grid-cols-[repeat(3,minmax(0,1fr))_auto]"
      >
        {RATING_CRITERIA.map((criterion) => (
          <label key={criterion} className="form-group min-w-0">
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
        <Button type="submit" variant="outline" className="w-full xl:w-auto">
          {row.ratingId ? "Save revision" : "Save rating"}
        </Button>
      </div>
    </form>
  );
}
