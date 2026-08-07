import { type BusinessDate, daysBetween } from "@/lib/domain/business-date";

// Urgency is derived from the deadline, never entered by hand — the spec has no manual priority
// field in Phase 1, deliberately, so that "urgent" cannot drift from "actually due soon".
export const URGENCY_BANDS = ["overdue", "urgent", "soon", "normal"] as const;
export type UrgencyBand = (typeof URGENCY_BANDS)[number];

export type UrgencyDescriptor = {
  band: UrgencyBand;
  daysRemaining: number;
  label: string;
};

/**
 * Bands come straight from the spec: overdue, due in 1-3 days, due in 4-7 days, and everything
 * beyond. `today` is passed in rather than read from the clock so callers stay pure and tests can
 * state the date instead of mocking time.
 */
export function computeUrgencyBand(input: { deadline: BusinessDate; today: BusinessDate }): UrgencyBand {
  const daysRemaining = daysBetween(input.today, input.deadline);
  if (daysRemaining < 0) return "overdue";
  if (daysRemaining <= 3) return "urgent";
  if (daysRemaining <= 7) return "soon";
  return "normal";
}

export function describeUrgency(input: { deadline: BusinessDate; today: BusinessDate }): UrgencyDescriptor {
  const daysRemaining = daysBetween(input.today, input.deadline);
  const band = computeUrgencyBand(input);

  return { band, daysRemaining, label: urgencyLabel(band, daysRemaining) };
}

function urgencyLabel(band: UrgencyBand, daysRemaining: number): string {
  if (band === "overdue") {
    const overdueBy = Math.abs(daysRemaining);
    return overdueBy === 1 ? "Overdue by 1 day" : `Overdue by ${overdueBy} days`;
  }
  if (daysRemaining === 0) return "Due today";
  if (daysRemaining === 1) return "Due tomorrow";
  return `Due in ${daysRemaining} days`;
}

// Tailwind classes rather than raw hex, and each band pairs a colour with a distinct word in the
// label above — colour alone never carries the meaning.
export function urgencyToneClasses(band: UrgencyBand): string {
  switch (band) {
    case "overdue":
      return "border-[#f0b4b4] bg-[#fdf0f0] text-[#8c1d1d]";
    case "urgent":
      return "border-[#f4c3b0] bg-[#fdf3ee] text-[#93380f]";
    case "soon":
      return "border-[#ecd9a4] bg-[#fbf5e6] text-[#7a5a12]";
    case "normal":
      return "border-[#d9d8d1] bg-[#f6f6f3] text-[#50586c]";
  }
}
