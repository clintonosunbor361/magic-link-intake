import Link from "next/link";

// Keep every Settings page on one navigation source so new sections appear consistently.
const SETTINGS_GROUPS = [
  {
    label: "Team",
    href: "/settings/team",
    links: [{ href: "/settings/team", label: "Team" }],
  },
  {
    label: "Workflow",
    href: "/settings/lead-sources",
    links: [
      { href: "/settings/lead-sources", label: "Lead sources" },
      { href: "/settings/consultation-note-sources", label: "Consultation note sources" },
      { href: "/settings/production-statuses", label: "Production statuses" },
    ],
  },
  {
    label: "Products",
    href: "/settings/item-types",
    links: [
      { href: "/settings/item-types", label: "Item types" },
      { href: "/settings/accessory-types", label: "Accessory types" },
      { href: "/settings/accessory-statuses", label: "Accessory statuses" },
    ],
  },
  {
    label: "Measurements",
    href: "/settings/measurement-fields",
    links: [
      { href: "/settings/measurement-fields", label: "Measurement fields" },
      { href: "/settings/measurement-requirements", label: "Measurement requirements" },
    ],
  },
  {
    label: "Vendors",
    href: "/settings/vendor-specialties",
    links: [{ href: "/settings/vendor-specialties", label: "Vendor specialties" }],
  },
  {
    label: "Log history",
    href: "/settings/log-history",
    links: [{ href: "/settings/log-history", label: "Log history" }],
  },
] as const;

export function SettingsNav({ current }: { current: string }) {
  const activeGroup = SETTINGS_GROUPS.find((group) => group.links.some((link) => link.href === current));

  return (
    <div className="mt-6">
      <nav className="flex flex-wrap gap-x-8 gap-y-1 border-b border-kuartz-line" aria-label="Settings groups">
        {SETTINGS_GROUPS.map((group) => {
          const active = group === activeGroup;
          const isPage = group.links.length === 1 && group.href === current;
          return (
            <Link
              key={group.href}
              href={group.href}
              aria-current={isPage ? "page" : undefined}
              className={`-mb-px inline-flex min-h-11 items-center border-b-2 px-2 text-sm transition-colors ${
                active
                  ? "border-kuartz-lime font-extrabold text-kuartz-ink"
                  : "border-transparent font-medium text-kuartz-secondary hover:text-kuartz-ink"
              }`}
            >
              {group.label}
            </Link>
          );
        })}
      </nav>

      {activeGroup && activeGroup.links.length > 1 ? (
        <nav className="flex flex-wrap gap-x-8 gap-y-1 border-b border-kuartz-line pt-2" aria-label={`${activeGroup.label} settings`}>
          {activeGroup.links.map((link) => {
            const active = link.href === current;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`-mb-px inline-flex min-h-10 items-center border-b-2 px-2 text-sm transition-colors ${
                  active
                    ? "border-kuartz-lime font-bold text-kuartz-ink"
                    : "border-transparent font-medium text-kuartz-secondary hover:text-kuartz-ink"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}
