import { signOutAction } from "@/app/actions/auth";
import { canManageFinance, canManageTeam } from "@/lib/domain/access-control";
import type { StaffSession } from "@/lib/auth/session";
import { Navigation } from "@/components/app-shell/navigation";
import { Button } from "@/components/ui/button";

export function AppShell({ session, children }: { session: StaffSession; children: React.ReactNode }) {
  const initials = session.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return (
    <div className="min-h-[100dvh] bg-kuartz-canvas lg:pl-[17rem]">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <Navigation
        canManageTeam={canManageTeam(session.role)}
        canManageFinance={canManageFinance(session.role)}
      />
      <header className="sticky top-0 z-20 flex h-[4.5rem] items-center justify-between border-b border-kuartz-line bg-kuartz-canvas/90 px-4 backdrop-blur-xl sm:px-7 lg:px-10">
        <div className="pl-12 lg:pl-0">
          <p className="text-sm font-semibold text-kuartz-ink">{session.organizationName}</p>
          <p className="text-xs text-kuartz-secondary">Operations workspace</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block"><p className="text-sm font-semibold text-kuartz-ink">{session.fullName}</p><p className="text-xs text-kuartz-secondary">{session.role === "super_admin" ? "Super Admin" : "Admin Assistant"}</p></div>
          <div className="grid h-9 w-9 place-items-center rounded-full bg-kuartz-ink text-xs font-bold text-white" aria-hidden="true">{initials}</div>
          <form action={signOutAction}><Button variant="ghost" type="submit">Sign out</Button></form>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-7 lg:px-10 lg:py-10">{children}</main>
    </div>
  );
}
