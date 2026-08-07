import type { VendorRatingSummary } from "@/lib/vendors/ratings";

// The Vendor picker's score block. Ratings land with Milestone 7's prompt flow, so today this
// almost always renders the unrated state — deliberately as words, not a 0.0 that reads like a
// genuinely bad vendor.
export function VendorScores({ summary, compact = false }: { summary: VendorRatingSummary; compact?: boolean }) {
  if (summary.state === "unrated") {
    return (
      <p className={compact ? "text-xs text-[#767b89]" : "text-sm text-[#767b89]"}>Not rated yet</p>
    );
  }

  const criteria = [
    { label: "Quality", value: summary.quality },
    { label: "Timeliness", value: summary.timeliness },
    { label: "Communication", value: summary.communication },
  ];

  return (
    <div className={compact ? "text-xs" : "text-sm"}>
      <p className="font-semibold text-[#171b36]">
        {summary.overall.toFixed(1)}
        <span className="font-medium text-[#767b89]"> / 5 overall</span>
        <span className="font-medium text-[#767b89]">
          {" "}
          · {summary.ratingCount} {summary.ratingCount === 1 ? "rating" : "ratings"}
        </span>
      </p>
      <dl className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[#50586c]">
        {criteria.map((criterion) => (
          <div key={criterion.label} className="flex gap-1">
            <dt>{criterion.label}</dt>
            <dd className="font-semibold text-[#171b36]">{criterion.value.toFixed(1)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function VendorJobStats({
  completedJobs,
  openJobs,
  lastJobDate,
  compact = false,
}: {
  completedJobs: number;
  openJobs: number;
  lastJobDate: string | null;
  compact?: boolean;
}) {
  return (
    <dl className={`flex flex-wrap gap-x-3 gap-y-1 ${compact ? "text-xs" : "text-sm"} text-[#50586c]`}>
      <div className="flex gap-1">
        <dt>Completed</dt>
        <dd className="font-semibold text-[#171b36]">{completedJobs}</dd>
      </div>
      <div className="flex gap-1">
        <dt>Open</dt>
        <dd className="font-semibold text-[#171b36]">{openJobs}</dd>
      </div>
      <div className="flex gap-1">
        <dt>Last job</dt>
        <dd className="font-semibold text-[#171b36]">{lastJobDate ?? "None yet"}</dd>
      </div>
    </dl>
  );
}

export function SpecialtyTags({ specialties }: { specialties: { id: string; name: string; archived: boolean }[] }) {
  if (!specialties.length) return <p className="text-xs text-[#767b89]">No specialties</p>;

  return (
    <ul className="flex flex-wrap gap-1.5">
      {specialties.map((specialty) => (
        <li
          key={specialty.id}
          className="rounded-full border border-[#d9d8d1] bg-[#f6f6f3] px-2.5 py-0.5 text-xs font-semibold text-[#50586c]"
        >
          {specialty.name}
          {specialty.archived ? <span className="font-medium text-[#8b8f9c]"> (archived tag)</span> : null}
        </li>
      ))}
    </ul>
  );
}
