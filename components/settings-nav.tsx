import Link from "next/link";

// Settings grew a sixth and seventh tab with Milestone 5, so the duplicated inline nav in each
// settings page is now one component. Behaviour is unchanged: plain links, current page marked
// with aria-current rather than colour alone.
const SETTINGS_LINKS = [
  { href: "/settings/team", label: "Team" },
  { href: "/settings/item-types", label: "Item types" },
  { href: "/settings/lead-sources", label: "Lead sources" },
  { href: "/settings/consultation-note-sources", label: "Consultation note sources" },
  { href: "/settings/measurement-fields", label: "Measurement fields" },
  { href: "/settings/measurement-requirements", label: "Measurement requirements" },
  { href: "/settings/vendor-specialties", label: "Vendor specialties" },
  { href: "/settings/production-statuses", label: "Production statuses" },
  { href: "/settings/accessory-types", label: "Accessory types" },
  { href: "/settings/accessory-statuses", label: "Accessory statuses" },
] as const;

export function SettingsNav({ current }: { current: string }) {
  return (
    <nav className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold" aria-label="Settings sections">
      {SETTINGS_LINKS.map((link) => {
        const active = link.href === current;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "text-kuartz-ink underline decoration-2 underline-offset-4"
                : "text-kuartz-secondary transition-colors duration-200 hover:text-kuartz-ink"
            }
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
