import { resolveVersionedUpdate } from "@/lib/domain/concurrency";
import { normalizeEmail, normalizePhone } from "@/lib/enquiries/duplicate-match";

export type ConversionOrderInput = {
  title: string;
  eventType: string;
  finalAgreedPriceMinor: number;
  primaryOwnerStaffId: string;
  ffDiscount: boolean;
  ffDiscountAmountMinor: number | null;
};

export type ConversionLookInput = {
  name: string;
  lookDate: string | null;
  notes: string;
};

export type EnquiryForConversion = {
  id: string;
  version: number;
  convertedAt: Date | null;
  archivedAt: Date | null;
  fullName: string;
  linkedClientId: string | null;
  primaryPhone: string;
  email: string | null;
};
export type ConversionClientConflict = {
  id: string;
  fullName: string;
  primaryPhone: string;
  email: string | null;
  reason: "phone" | "email";
};

export type ConversionRepository = {
  getEnquiryForConversion(organizationId: string, enquiryId: string): Promise<EnquiryForConversion | null>;
  findClientIdentityConflict(input: {
    organizationId: string;
    primaryPhoneNormalized: string;
    emailNormalized: string | null;
  }): Promise<ConversionClientConflict | null>;
  convertEnquiry(input: {
    organizationId: string;
    enquiryId: string;
    expectedVersion: number;
    nextVersion: number;
    actorId: string;
    existingClientId: string | null;
    order: ConversionOrderInput;
    look: ConversionLookInput;
  }): Promise<{ clientId: string; orderId: string; lookId: string }>;
};

export async function convertEnquiryToClientAndOrder(
  input: {
    organizationId: string;
    enquiryId: string;
    expectedVersion: number;
    actorId: string;
    existingClientId: string | null;
    order: ConversionOrderInput;
    look: ConversionLookInput;
  },
  repository: ConversionRepository,
) {
  const enquiry = await repository.getEnquiryForConversion(input.organizationId, input.enquiryId);
  if (!enquiry) throw new Error("Enquiry was not found.");
  if (enquiry.convertedAt) throw new Error("This Enquiry has already been converted.");
  if (enquiry.archivedAt) throw new Error("Restore this Enquiry before converting it.");

  if (!input.order.title.trim()) throw new Error("Order title is required.");
  if (!input.order.eventType.trim()) throw new Error("Event type is required.");
  if (!Number.isInteger(input.order.finalAgreedPriceMinor) || input.order.finalAgreedPriceMinor <= 0) {
    throw new Error("Final agreed price must be greater than zero.");
  }
  if (!input.order.primaryOwnerStaffId) throw new Error("Primary owner is required.");
  if (!input.look.name.trim()) throw new Error("Look name is required.");
  if (!input.existingClientId && !enquiry.linkedClientId) {
    const conflict = await repository.findClientIdentityConflict({
      organizationId: input.organizationId,
      primaryPhoneNormalized: normalizePhone(enquiry.primaryPhone),
      emailNormalized: enquiry.email ? normalizeEmail(enquiry.email) : null,
    });
    if (conflict) {
      throw new Error(
        conflict.reason === "phone"
          ? `An existing Client already uses this phone number: ${conflict.fullName} (${conflict.primaryPhone}). Attach this Enquiry to that Client before converting.`
          : `An existing Client already uses this email address: ${conflict.fullName} (${conflict.email}). Attach this Enquiry to that Client before converting.`,
      );
    }
  }

  const version = resolveVersionedUpdate({
    expectedVersion: input.expectedVersion,
    currentVersion: enquiry.version,
  });
  if (!version.ok) throw new Error("This Enquiry changed. Reload and try again.");

  return repository.convertEnquiry({
    organizationId: input.organizationId,
    enquiryId: input.enquiryId,
    expectedVersion: input.expectedVersion,
    nextVersion: version.nextVersion,
    actorId: input.actorId,
    existingClientId: input.existingClientId,
    order: input.order,
    look: input.look,
  });
}
