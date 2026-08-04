"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { STAFF_ROLES, type StaffRole } from "@/lib/domain/access-control";
import { requireSuperAdmin } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { changeStaffRole } from "@/lib/team/service";
import { addInvitedStaffMember, createStaffRepository } from "@/lib/team/repository";
import { readFormString } from "@/lib/forms/read-string";

function roleValue(formData: FormData): StaffRole {
  const candidate = readFormString(formData, "role");
  if (!STAFF_ROLES.includes(candidate as StaffRole)) throw new Error("Invalid staff role.");
  return candidate as StaffRole;
}

export async function inviteStaffMemberAction(formData: FormData) {
  const actor = await requireSuperAdmin();
  const fullName = readFormString(formData, "fullName");
  const email = readFormString(formData, "email").toLowerCase();
  const role = roleValue(formData);
  if (!fullName || !email) redirect("/settings/team?error=Name+and+email+are+required.");

  const admin = createSupabaseAdminClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo: `${appUrl}/auth/callback?next=/auth/update-password`,
  });
  if (error || !data.user) redirect("/settings/team?error=The+invitation+could+not+be+sent.");

  try {
    await addInvitedStaffMember({
      organizationId: actor.organizationId,
      actorId: actor.userId,
      userId: data.user.id,
      fullName,
      email,
      role,
    });
  } catch {
    await admin.auth.admin.deleteUser(data.user.id);
    redirect("/settings/team?error=The+membership+could+not+be+created.");
  }
  revalidatePath("/settings/team");
  redirect("/settings/team?invited=1");
}

export async function changeStaffRoleAction(formData: FormData) {
  const actor = await requireSuperAdmin();
  try {
    await changeStaffRole(
      {
        actor,
        staffMemberId: readFormString(formData, "staffMemberId"),
        role: roleValue(formData),
        expectedVersion: Number(readFormString(formData, "version")),
      },
      createStaffRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The role could not be changed.";
    redirect(`/settings/team?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/settings/team");
}
