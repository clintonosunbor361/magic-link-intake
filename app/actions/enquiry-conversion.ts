"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaffSession } from "@/lib/auth/session";
import { readFormString } from "@/lib/forms/read-string";
import { convertEnquiryToClientAndOrder } from "@/lib/enquiries/conversion-service";
import { createConversionRepository } from "@/lib/enquiries/repository";
import { parseMoneyToMinorUnits } from "@/lib/forms/money";

export async function convertEnquiryAction(formData: FormData) {
  const session = await requireStaffSession();
  const enquiryId = readFormString(formData, "enquiryId");
  const expectedVersion = Number(readFormString(formData, "version"));
  const existingClientId = readFormString(formData, "existingClientId") || null;
  const title = readFormString(formData, "title");
  const eventType = readFormString(formData, "eventType");
  const finalAgreedPriceMinor = parseMoneyToMinorUnits(readFormString(formData, "finalAgreedPrice"));
  const primaryOwnerStaffId = readFormString(formData, "primaryOwnerStaffId") || session.userId;
  const ffDiscount = formData.get("ffDiscount") === "on";
  const ffDiscountAmountRaw = readFormString(formData, "ffDiscountAmount");
  const ffDiscountAmountMinor = ffDiscountAmountRaw ? parseMoneyToMinorUnits(ffDiscountAmountRaw) : null;
  const lookName = readFormString(formData, "lookName");
  const lookDate = readFormString(formData, "lookDate") || null;
  const lookNotes = readFormString(formData, "lookNotes");

  try {
    await convertEnquiryToClientAndOrder(
      {
        organizationId: session.organizationId,
        enquiryId,
        expectedVersion,
        actorId: session.userId,
        existingClientId,
        order: {
          title,
          eventType,
          finalAgreedPriceMinor,
          primaryOwnerStaffId,
          ffDiscount,
          ffDiscountAmountMinor,
        },
        look: { name: lookName, lookDate, notes: lookNotes },
      },
      createConversionRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Enquiry could not be converted.";
    redirect(`/enquiries/${enquiryId}/convert?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/enquiries");
  revalidatePath(`/enquiries/${enquiryId}`);
  redirect(`/enquiries/${enquiryId}`);
}
