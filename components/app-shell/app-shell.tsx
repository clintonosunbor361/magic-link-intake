import { signOutAction } from "@/app/actions/auth";
import { canManageTeam } from "@/lib/domain/access-control";
import type { StaffSession } from "@/lib/auth/session";
import { Navigation } from "@/components/app-shell/navigation";
import { Button } from "@/components/ui/button";

export function AppShell({ session, children }: { session: StaffSession; children: React.ReactNode }) {
  const initials = session.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return (
    <div className="min-h-[100dvh] bg-[#f4f3ee] lg:pl-[17rem]">
      <Navigation canManageTeam={canManageTeam(session.role)} />
      <header className="sticky top-0 z-20 flex h-[4.5rem] items-center justify-between border-b border-[#d9d8d1] bg-[#f4f3ee]/90 px-4 backdrop-blur-xl sm:px-7 lg:px-10">
        <div className="pl-12 lg:pl-0">
          <p className="text-sm font-semibold text-[#171b36]">{session.organizationName}</p>
          <p className="text-xs text-[#767b89]">Operations workspace</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block"><p className="text-sm font-semibold text-[#171b36]">{session.fullName}</p><p className="text-xs text-[#767b89]">{session.role === "super_admin" ? "Super Admin" : "Admin Assistant"}</p></div>
          <div className="grid h-9 w-9 place-items-center rounded-full bg-[#171b36] text-xs font-bold text-white" aria-hidden="true">{initials}</div>
          <form action={signOutAction}><Button variant="ghost" type="submit">Sign out</Button></form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-7 lg:px-10 lg:py-10">{children}</main>
    </div>
  );
}
