import { redirect } from "next/navigation";
import {
  changeStaffRoleAction,
  inviteStaffMemberAction,
} from "@/app/actions/team";
import { requireStaffSession } from "@/lib/auth/session";
import { canManageTeam } from "@/lib/domain/access-control";
import { listStaffMembers } from "@/lib/team/repository";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { SettingsNav } from "@/components/settings-nav";
import { FormModal } from "@/components/ui/form-modal";

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; invited?: string }>;
}) {
  const session = await requireStaffSession();
  if (!canManageTeam(session.role)) redirect("/");
  const [members, params] = await Promise.all([
    listStaffMembers(session.organizationId),
    searchParams,
  ]);
  return (
    <div>
      <header className="border-b border-kuartz-line pb-8">
        <p className="eyebrow">Organization settings</p>
        <h1 className="page-title">Team and access</h1>
        <p className="page-description">
          Invite staff, assign operational authority, and review access changes.
        </p>
      </header>
      <SettingsNav current="/settings/team" />
      {params.invited ? (
        <p className="form-success mt-6">
          Invitation sent and membership created.
        </p>
      ) : null}
      <section className="mt-9">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="section-title">Active staff</h2>
          <FormModal title="Invite staff" buttonLabel="Invite staff" error={params.error} showSectionTitle={false}>
            <form action={inviteStaffMemberAction} className="space-y-4">
              <label className="form-group">
                <span>Full name</span>
                <Input name="fullName" required />
              </label>
              <label className="form-group">
                <span>Email address</span>
                <Input name="email" type="email" required />
              </label>
              <label className="form-group">
                <span>Role</span>
                <NativeSelect name="role" defaultValue="admin_assistant">
                  <option value="admin_assistant">Admin Assistant</option>
                  <option value="super_admin">Super Admin</option>
                </NativeSelect>
              </label>
              <Button className="w-full" type="submit">Send invitation</Button>
            </form>
          </FormModal>
        </div>
        <div className="mt-4 min-w-0">
          <div className="mt-4 divide-y divide-kuartz-line border-y border-kuartz-line">
            {members.map((member) => (
              <div
                key={member.userId}
                className="grid min-w-0 gap-4 py-5 md:grid-cols-[minmax(0,1fr)_minmax(17rem,20rem)] md:items-center"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-kuartz-ink">
                    {member.fullName}
                  </p>
                  <p className="mt-1 break-words text-sm text-kuartz-muted">
                    {member.email}
                  </p>
                </div>
                <form action={changeStaffRoleAction} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2">
                  <input
                    type="hidden"
                    name="staffMemberId"
                    value={member.userId}
                  />
                  <input type="hidden" name="version" value={member.version} />
                  <NativeSelect
                    className="min-h-10 py-2"
                    name="role"
                    defaultValue={member.role}
                  >
                    <option value="super_admin">Super Admin</option>
                    <option value="admin_assistant">Admin Assistant</option>
                  </NativeSelect>
                  <Button variant="outline" type="submit">
                    Save
                  </Button>
                </form>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
