import { AppShell } from "@/components/app-shell/app-shell";
import { requireStaffSession } from "@/lib/auth/session";

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const session = await requireStaffSession();
  return <AppShell session={session}>{children}</AppShell>;
}
