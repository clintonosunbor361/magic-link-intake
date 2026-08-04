import "server-only";

import { redirect } from "next/navigation";
import type { StaffRole } from "@/lib/domain/access-control";
import { assertCanManageTeam } from "@/lib/domain/access-control";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type StaffSession = {
  userId: string;
  email: string;
  fullName: string;
  organizationId: string;
  organizationName: string;
  role: StaffRole;
};

export async function getStaffSession(): Promise<StaffSession | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (error || !userId) return null;

  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("organization_id, role, organizations(name), staff_profiles!inner(full_name, email)")
    .eq("user_id", userId)
    .is("archived_at", null)
    .limit(1)
    .maybeSingle();

  if (!membership) return null;
  const organization = membership.organizations as unknown as { name: string } | null;
  const profile = membership.staff_profiles as unknown as {
    full_name: string;
    email: string;
  } | null;

  if (!organization || !profile) return null;
  return {
    userId,
    email: profile.email,
    fullName: profile.full_name,
    organizationId: membership.organization_id,
    organizationName: organization.name,
    role: membership.role as StaffRole,
  };
}

export async function requireStaffSession(): Promise<StaffSession> {
  const session = await getStaffSession();
  if (!session) {
    const supabase = await createSupabaseServerClient();
    const { data } = (await supabase?.auth.getClaims()) ?? { data: null };
    redirect(data?.claims?.sub ? "/auth/unauthorized" : "/auth/sign-in");
  }
  return session;
}

export async function requireSuperAdmin(): Promise<StaffSession> {
  const session = await requireStaffSession();
  assertCanManageTeam(session.role);
  return session;
}
