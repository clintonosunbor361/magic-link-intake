import Link from "next/link";
import { redirect } from "next/navigation";
import { changeStaffRoleAction, inviteStaffMemberAction } from "@/app/actions/team";
import { requireStaffSession } from "@/lib/auth/session";
import { canManageTeam } from "@/lib/domain/access-control";
import { listAuditEntries, listStaffMembers } from "@/lib/team/repository";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

const date = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" });

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ error?: string; invited?: string }> }) {
  const session = await requireStaffSession();
  if (!canManageTeam(session.role)) redirect("/");
  const [members, audits, params] = await Promise.all([listStaffMembers(session.organizationId), listAuditEntries(session.organizationId), searchParams]);
  return (
    <div>
      <header className="border-b border-[#d9d8d1] pb-8"><p className="eyebrow">Organization settings</p><h1 className="page-title">Team and access</h1><p className="page-description">Invite staff, assign operational authority, and review access changes.</p></header>
      <nav className="mt-6 flex gap-4 text-sm font-semibold"><Link href="/settings/team" className="text-[#171b36] underline">Team</Link><Link href="/settings/item-types" className="text-[#50586c] hover:text-[#171b36]">Item types</Link></nav>
      {params.error ? <p className="form-alert mt-6" role="alert">{params.error}</p> : null}{params.invited ? <p className="form-success mt-6">Invitation sent and membership created.</p> : null}
      <section className="mt-9 grid gap-10 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div><h2 className="section-title">Active staff</h2><div className="mt-4 divide-y divide-[#d9d8d1] border-y border-[#d9d8d1]">{members.map((member) => <div key={member.userId} className="grid gap-4 py-5 md:grid-cols-[minmax(0,1fr)_14rem] md:items-center"><div><p className="font-semibold text-[#171b36]">{member.fullName}</p><p className="mt-1 text-sm text-[#767b89]">{member.email}</p></div><form action={changeStaffRoleAction} className="flex gap-2"><input type="hidden" name="staffMemberId" value={member.userId} /><input type="hidden" name="version" value={member.version} /><NativeSelect className="min-h-10 py-2" name="role" defaultValue={member.role}><option value="super_admin">Super Admin</option><option value="admin_assistant">Admin Assistant</option></NativeSelect><Button variant="outline" type="submit">Save</Button></form></div>)}</div></div>
        <aside><h2 className="section-title">Invite staff</h2><form action={inviteStaffMemberAction} className="mt-4 space-y-4 border-t border-[#d9d8d1] pt-5"><label className="form-group"><span>Full name</span><Input name="fullName" required /></label><label className="form-group"><span>Email address</span><Input name="email" type="email" required /></label><label className="form-group"><span>Role</span><NativeSelect name="role" defaultValue="admin_assistant"><option value="admin_assistant">Admin Assistant</option><option value="super_admin">Super Admin</option></NativeSelect></label><Button className="w-full" type="submit">Send invitation</Button></form></aside>
      </section>
      <section className="mt-14"><div className="flex items-end justify-between"><div><p className="eyebrow">Immutable evidence</p><h2 className="section-title mt-2">Recent access activity</h2></div></div><div className="mt-4 divide-y divide-[#d9d8d1] border-y border-[#d9d8d1]">{audits.length ? audits.map((entry) => <div key={entry.id} className="grid gap-1 py-4 text-sm sm:grid-cols-[1fr_auto]"><p className="font-medium text-[#262b44]">{entry.summary}</p><p className="text-[#858a96]">{entry.actorName ?? "System"} · {date.format(entry.createdAt)}</p></div>) : <p className="py-8 text-sm text-[#767b89]">No access changes recorded yet.</p>}</div></section>
    </div>
  );
}
