import "server-only";

import { getClient } from "@/lib/clients/repository";
import { getMeasurementProfileClient, listMeasurementProfileSnapshot } from "@/lib/measurement-profiles/repository";
import { getOrderWithLooksAndItems } from "@/lib/orders/repository";

export type MeasurementProfileConfirmationContent = {
  clientFullName: string;
  fields: { fieldId: string; fieldName: string; unit: string; value: string }[];
};

// Renders the live current profile, not a frozen snapshot — a resend already invalidates the
// prior confirmation, so there is no "stale link" risk this would otherwise be guarding against.
export async function getMeasurementProfileConfirmationContent(
  organizationId: string,
  measurementProfileId: string,
): Promise<MeasurementProfileConfirmationContent | null> {
  const profile = await getMeasurementProfileClient(organizationId, measurementProfileId);
  if (!profile) return null;
  const client = await getClient(organizationId, profile.clientId);
  if (!client) return null;

  const snapshot = await listMeasurementProfileSnapshot(organizationId, measurementProfileId);
  return {
    clientFullName: client.fullName,
    fields: snapshot
      .filter((field): field is typeof field & { value: string } => field.value !== null)
      .map((field) => ({ fieldId: field.fieldId, fieldName: field.fieldName, unit: field.unit, value: field.value })),
  };
}

export type OrderDetailConfirmationContent = {
  clientFullName: string;
  orderTitle: string;
  finalAgreedPriceMinor: number;
  looks: {
    id: string;
    name: string;
    notes: string;
    items: { id: string; label: string; quantity: number }[];
  }[];
};

export async function getOrderDetailConfirmationContent(
  organizationId: string,
  orderId: string,
): Promise<OrderDetailConfirmationContent | null> {
  const order = await getOrderWithLooksAndItems(organizationId, orderId);
  if (!order) return null;

  return {
    clientFullName: order.clientFullName,
    orderTitle: order.title,
    finalAgreedPriceMinor: order.finalAgreedPriceMinor,
    looks: order.looks
      .filter((look) => !look.archivedAt)
      .map((look) => ({
        id: look.id,
        name: look.name,
        notes: look.notes,
        items: look.items
          .filter((item) => !item.archivedAt)
          .map((item) => ({ id: item.id, label: item.customLabel || item.itemTypeName, quantity: item.quantity })),
      })),
  };
}
