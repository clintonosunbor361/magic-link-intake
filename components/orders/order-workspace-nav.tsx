import Link from "next/link";
import { ChevronDown } from "lucide-react";

type WorkspaceTab = {
  id: string;
  label: string;
  href: string;
};

type OrderWorkspaceNavProps = {
  tabs: WorkspaceTab[];
  activeTab: string;
};

export function OrderWorkspaceNav({ tabs, activeTab }: OrderWorkspaceNavProps) {
  const active = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  return (
    <div className="mt-6">
      <details className="group relative md:hidden">
        <summary className="select-field min-h-[3.15rem] cursor-pointer list-none">
          <span className="truncate pr-10">{active?.label ?? "Overview"}</span>
          <ChevronDown
            aria-hidden="true"
            className="select-chevron transition-transform group-open:rotate-180"
          />
        </summary>
        <div className="select-menu select-menu-open">
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              href={tab.href}
              aria-current={tab.id === activeTab ? "page" : undefined}
              className={`select-option ${tab.id === activeTab ? "select-option-active" : ""}`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </details>

      <nav aria-label="Order workspace tabs" className="hidden border-b border-kuartz-line md:block">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <Link
                key={tab.id}
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={
                  isActive
                    ? "inline-flex min-h-11 items-center border-b-2 border-kuartz-lime px-3 text-sm font-extrabold text-kuartz-ink"
                    : "inline-flex min-h-11 items-center border-b-2 border-transparent px-3 text-sm font-bold text-kuartz-secondary transition-colors hover:text-kuartz-ink"
                }
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
