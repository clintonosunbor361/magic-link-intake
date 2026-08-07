"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaffSession } from "@/lib/auth/session";
import { readFormString } from "@/lib/forms/read-string";
import { createVendorRatingRepository } from "@/lib/vendors/rating-repository";
import { rateVendorOnOrder, reviseVendorRating } from "@/lib/vendors/rating-service";

function scoresFrom(formData: FormData) {
  return {
    quality: Number(readFormString(formData, "quality")),
    timeliness: Number(readFormString(formData, "timeliness")),
    communication: Number(readFormString(formData, "communication")),
  };
}

export async function rateVendorAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");
  const vendorId = readFormString(formData, "vendorId");
  const existingVersion = readFormString(formData, "ratingVersion");

  const input = {
    actor: { role: session.role, staffId: session.userId },
    organizationId: session.organizationId,
    orderId,
    vendorId,
    scores: scoresFrom(formData),
  };

  try {
    // The same form serves first-rating and revision — an existing version means we are editing.
    if (existingVersion) {
      await reviseVendorRating(
        { ...input, expectedVersion: Number(existingVersion) },
        createVendorRatingRepository(),
      );
    } else {
      await rateVendorOnOrder(input, createVendorRatingRepository());
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "The rating could not be saved.";
    redirect(`/orders/${orderId}/vendor-ratings?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/orders/${orderId}/vendor-ratings`);
  revalidatePath("/vendors");
  redirect(`/orders/${orderId}/vendor-ratings`);
}
