"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaffSession } from "@/lib/auth/session";
import { readFormString } from "@/lib/forms/read-string";
import { parseMoneyToMinorUnits } from "@/lib/forms/money";
import { safeReturnPath, withReturnError } from "@/lib/forms/return-path";
import { createAssignmentRepository } from "@/lib/production/assignment-repository";
import {
  assignVendorToItem,
  bulkAssignVendorToLook,
  reassignVendor,
  updateAssignmentTerms,
} from "@/lib/production/assignment-service";
import {
  createProductionNoteRepository,
  createProductionStatusChangeRepository,
} from "@/lib/production/status-change-repository";
import { addProductionNote, changeProductionStatus } from "@/lib/production/status-change-service";

function termsFrom(formData: FormData) {
  const rawCost = readFormString(formData, "agreedVendorCostMinor");
  return {
    deadline: readFormString(formData, "deadline"),
    // Agreed cost is optional: it is often negotiated after the vendor is booked.
    agreedVendorCostMinor: rawCost ? parseMoneyToMinorUnits(rawCost) : null,
  };
}

function actorFrom(session: { role: "super_admin" | "admin_assistant"; userId: string }) {
  return { role: session.role, staffId: session.userId };
}

export async function assignVendorAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");
  const returnTo = safeReturnPath(readFormString(formData, "returnTo"), `/orders/${orderId}?tab=looks`);

  try {
    await assignVendorToItem(
      {
        actor: actorFrom(session),
        organizationId: session.organizationId,
        itemId: readFormString(formData, "itemId"),
        vendorId: readFormString(formData, "vendorId"),
        ...termsFrom(formData),
      },
      createAssignmentRepository(),
    );
  } catch (error) {
    return backTo(returnTo, message(error, "The Vendor could not be assigned."));
  }

  revalidateProduction(orderId);
  redirect(returnTo);
}

export async function bulkAssignVendorAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");
  const returnTo = safeReturnPath(readFormString(formData, "returnTo"), `/orders/${orderId}?tab=looks`);
  let notice: string;

  try {
    const result = await bulkAssignVendorToLook(
      {
        actor: actorFrom(session),
        organizationId: session.organizationId,
        lookId: readFormString(formData, "lookId"),
        vendorId: readFormString(formData, "vendorId"),
        ...termsFrom(formData),
      },
      createAssignmentRepository(),
    );
    // Skips are always surfaced: a bulk action that quietly did less than it looked like it did is
    // exactly what this design avoids.
    notice = result.message;
  } catch (error) {
    return backTo(returnTo, message(error, "The Items could not be assigned."));
  }

  revalidateProduction(orderId);
  redirect(withNotice(returnTo, notice));
}

export async function updateAssignmentTermsAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");
  const returnTo = safeReturnPath(readFormString(formData, "returnTo"), `/orders/${orderId}?tab=looks`);

  try {
    await updateAssignmentTerms(
      {
        actor: actorFrom(session),
        organizationId: session.organizationId,
        assignmentId: readFormString(formData, "assignmentId"),
        expectedVersion: Number(readFormString(formData, "version")),
        ...termsFrom(formData),
      },
      createAssignmentRepository(),
    );
  } catch (error) {
    return backTo(returnTo, message(error, "The assignment could not be updated."));
  }

  revalidateProduction(orderId);
  redirect(returnTo);
}

export async function reassignVendorAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");
  const returnTo = safeReturnPath(readFormString(formData, "returnTo"), `/orders/${orderId}?tab=looks`);

  try {
    await reassignVendor(
      {
        actor: actorFrom(session),
        organizationId: session.organizationId,
        assignmentId: readFormString(formData, "assignmentId"),
        vendorId: readFormString(formData, "vendorId"),
        expectedVersion: Number(readFormString(formData, "version")),
        reason: readFormString(formData, "reason"),
        ...termsFrom(formData),
      },
      createAssignmentRepository(),
    );
  } catch (error) {
    return backTo(returnTo, message(error, "The Item could not be reassigned."));
  }

  revalidateProduction(orderId);
  redirect(withNotice(returnTo, "Reassigned. The previous Vendor's production history and notes stay with their assignment."));
}

export async function changeProductionStatusAction(formData: FormData) {
  const session = await requireStaffSession();
  const returnTo = readFormString(formData, "returnTo") || "/production";

  try {
    await changeProductionStatus(
      {
        actor: actorFrom(session),
        organizationId: session.organizationId,
        assignmentId: readFormString(formData, "assignmentId"),
        newStatusId: readFormString(formData, "newStatusId"),
        note: readFormString(formData, "note") || null,
        expectedVersion: Number(readFormString(formData, "version")),
      },
      createProductionStatusChangeRepository(),
    );
  } catch (error) {
    return backTo(returnTo, message(error, "The status could not be changed."));
  }

  revalidatePath("/production");
  revalidatePath(returnTo);
  redirect(returnTo);
}

export async function addProductionNoteAction(formData: FormData) {
  const session = await requireStaffSession();
  const returnTo = readFormString(formData, "returnTo") || "/production";

  try {
    await addProductionNote(
      {
        actor: actorFrom(session),
        organizationId: session.organizationId,
        assignmentId: readFormString(formData, "assignmentId"),
        note: readFormString(formData, "note"),
      },
      createProductionNoteRepository(),
    );
  } catch (error) {
    return backTo(returnTo, message(error, "The note could not be added."));
  }

  revalidatePath(returnTo);
  redirect(returnTo);
}

function revalidateProduction(orderId: string) {
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/production");
  revalidatePath("/vendors");
}

function backTo(path: string, error: string): never {
  redirect(withReturnError(path, error));
}

function withNotice(path: string, notice: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}notice=${encodeURIComponent(notice)}`;
}

function message(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
