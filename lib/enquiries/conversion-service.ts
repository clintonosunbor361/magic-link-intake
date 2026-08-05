import { resolveVersionedUpdate } from "@/lib/domain/concurrency";

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
};

export type ConversionRepository = {
  getEnquiryForConversion(organizationId: string, enquiryId: string): Promise<EnquiryForConversion | null>;
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
