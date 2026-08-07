import { type UrgencyDescriptor, urgencyToneClasses } from "@/lib/production/urgency";

// The band supplies the colour; the label always spells the meaning out in words, so the badge
// still reads correctly in greyscale or to anyone who cannot distinguish the tones.
export function UrgencyBadge({ urgency, deadline }: { urgency: UrgencyDescriptor; deadline: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${urgencyToneClasses(urgency.band)}`}
    >
      {urgency.label}
      <span className="font-medium opacity-70">· {deadline}</span>
    </span>
  );
}
