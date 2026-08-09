"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaffSession } from "@/lib/auth/session";
import { readFormString } from "@/lib/forms/read-string";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/notifications/repository";

// Read state is organization-wide, matching how the notifications themselves are scoped: the
// dashboard is a shared operational view, so one person clearing a reminder clears it for the team
// rather than leaving everyone else to dismiss the same thing again.

export async function markNotificationReadAction(formData: FormData) {
  const session = await requireStaffSession();
  const notificationId = readFormString(formData, "notificationId");
  const returnTo = readFormString(formData, "returnTo") || "/notifications";

  await markNotificationRead(session.organizationId, notificationId);

  revalidatePath("/notifications");
  revalidatePath("/");
  redirect(returnTo);
}

export async function markAllNotificationsReadAction(formData: FormData) {
  const session = await requireStaffSession();
  const returnTo = readFormString(formData, "returnTo") || "/notifications";

  await markAllNotificationsRead(session.organizationId);

  revalidatePath("/notifications");
  revalidatePath("/");
  redirect(returnTo);
}
