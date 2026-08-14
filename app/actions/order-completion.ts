"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaffSession } from "@/lib/auth/session";
import { completeOrder } from "@/lib/finance/completion-service";
import { createOrderCompletionRepository } from "@/lib/finance/repository";
import { readFormString } from "@/lib/forms/read-string";
import { listOrderVendorsForRating } from "@/lib/vendors/rating-repository";

export async function completeOrderAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");

  try {
    await completeOrder(
      {
        actor: { role: session.role, staffId: session.userId },
        organizationId: session.organizationId,
        orderId,
        overrideReason: readFormString(formData, "overrideReason") || null,
      },
      createOrderCompletionRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Order could not be completed.";
    redirect(`/orders/${orderId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/orders/${orderId}`);
  const vendors = await listOrderVendorsForRating(session.organizationId, orderId);
  if (vendors.some((vendor) => !vendor.ratingId)) redirect(`/orders/${orderId}/vendor-ratings?from=completion`);
  redirect(`/orders/${orderId}`);
}
