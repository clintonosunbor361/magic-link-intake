"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaffSession } from "@/lib/auth/session";
import { readFormString } from "@/lib/forms/read-string";
import { BUDGET_RANGES, CONTACT_CHANNELS, EVENT_TYPES } from "@/lib/intake-options";
import {
  archiveEnquiry,
  createInternalEnquiry,
  restoreEnquiry,
  updateEnquiryDetails,
  type CreateInternalEnquiryResult,
} from "@/lib/enquiries/service";
import { addFollowUpNote, completeTask, createTask, reopenTask } from "@/lib/enquiries/follow-up-service";
import { createEnquiryRepository, createFollowUpRepository } from "@/lib/enquiries/repository";

function optionValue<T extends readonly string[]>(formData: FormData, key: string, allowed: T): T[number] {
  const value = readFormString(formData, key);
  if (!(allowed as readonly string[]).includes(value)) throw new Error(`Select a valid ${key}.`);
  return value as T[number];
}

export async function createInternalEnquiryAction(formData: FormData) {
  const session = await requireStaffSession();
  const linkedClientId = readFormString(formData, "linkedClientId") || null;

  const fullName = readFormString(formData, "fullName");
  const primaryPhone = readFormString(formData, "primaryPhone");
  const whatsappSameAsPrimary = formData.get("whatsappSameAsPrimary") === "on";
  const whatsappPhone = readFormString(formData, "whatsappPhone");
  const email = readFormString(formData, "email");
  const preferredContactChannel = optionValue(formData, "preferredContactChannel", CONTACT_CHANNELS);
  const eventType = optionValue(formData, "eventType", EVENT_TYPES);
  const budgetRange = optionValue(formData, "budgetRange", BUDGET_RANGES);
  const brief = readFormString(formData, "brief");
  const leadSource = readFormString(formData, "leadSource");
  const ownerStaffId = readFormString(formData, "ownerStaffId");
  const internalNotes = readFormString(formData, "internalNotes");
  const acknowledgedDuplicates = formData.get("acknowledgedDuplicates") === "on";

  let result: CreateInternalEnquiryResult;
  try {
    result = await createInternalEnquiry(
      {
        actor: { organizationId: session.organizationId, role: session.role },
        enquiry: {
          fullName,
          primaryPhone,
          whatsappSameAsPrimary,
          whatsappPhone,
          email,
          preferredContactChannel,
          eventType,
          budgetRange,
          brief,
          leadSource,
          ownerStaffId,
          internalNotes,
          linkedClientId,
          acknowledgedDuplicates,
        },
      },
      createEnquiryRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Enquiry could not be created.";
    redirect(`/enquiries/new?error=${encodeURIComponent(message)}${linkedClientId ? `&clientId=${encodeURIComponent(linkedClientId)}` : ""}`);
  }

  if (!result.ok) {
    redirect(
      `/enquiries/new?error=Potential+duplicate+contacts+were+found.+Review+them+and+confirm+to+continue.${linkedClientId ? `&clientId=${encodeURIComponent(linkedClientId)}` : ""}`,
    );
  }

  revalidatePath("/enquiries");
  redirect(`/enquiries/${result.enquiryId}`);
}

export async function addFollowUpNoteAction(formData: FormData) {
  const session = await requireStaffSession();
  const enquiryId = readFormString(formData, "enquiryId");
  const note = readFormString(formData, "note");
  const nextFollowUpDate = readFormString(formData, "nextFollowUpDate");
  const occurredOn = readFormString(formData, "occurredOn") || new Date().toISOString().slice(0, 10);

  try {
    await addFollowUpNote(
      {
        organizationId: session.organizationId,
        enquiryId,
        note,
        occurredOn,
        nextFollowUpDate: nextFollowUpDate || null,
        createdByStaffId: session.userId,
      },
      createFollowUpRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The note could not be added.";
    redirect(`/enquiries/${enquiryId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/enquiries/${enquiryId}`);
  redirect(`/enquiries/${enquiryId}`);
}

export async function updateEnquiryDetailsAction(formData: FormData) {
  const session = await requireStaffSession();
  const enquiryId = readFormString(formData, "enquiryId");
  const expectedVersion = Number(readFormString(formData, "version"));
  const linkedClientId = readFormString(formData, "linkedClientId") || null;

  const fullName = readFormString(formData, "fullName");
  const primaryPhone = readFormString(formData, "primaryPhone");
  const whatsappSameAsPrimary = formData.get("whatsappSameAsPrimary") === "on";
  const whatsappPhone = readFormString(formData, "whatsappPhone");
  const email = readFormString(formData, "email");
  const preferredContactChannel = optionValue(formData, "preferredContactChannel", CONTACT_CHANNELS);
  const eventType = optionValue(formData, "eventType", EVENT_TYPES);
  const budgetRange = optionValue(formData, "budgetRange", BUDGET_RANGES);
  const brief = readFormString(formData, "brief");
  const leadSource = readFormString(formData, "leadSource");
  const ownerStaffId = readFormString(formData, "ownerStaffId");
  const internalNotes = readFormString(formData, "internalNotes");

  try {
    await updateEnquiryDetails(
      {
        actor: { organizationId: session.organizationId, role: session.role },
        enquiryId,
        expectedVersion,
        fields: {
          fullName,
          primaryPhone,
          whatsappSameAsPrimary,
          whatsappPhone,
          email,
          preferredContactChannel,
          eventType,
          budgetRange,
          brief,
          leadSource,
          ownerStaffId,
          internalNotes,
          linkedClientId,
        },
      },
      createEnquiryRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Enquiry could not be updated.";
    redirect(`/enquiries/${enquiryId}/edit?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/enquiries/${enquiryId}`);
  revalidatePath("/enquiries");
  redirect(`/enquiries/${enquiryId}`);
}

export async function createTaskAction(formData: FormData) {
  const session = await requireStaffSession();
  const enquiryId = readFormString(formData, "enquiryId");
  const title = readFormString(formData, "title");
  const dueDate = readFormString(formData, "dueDate");
  const assignedToStaffId = readFormString(formData, "assignedToStaffId") || session.userId;
  const note = readFormString(formData, "note");

  try {
    await createTask(
      {
        organizationId: session.organizationId,
        enquiryId,
        title,
        dueDate,
        assignedToStaffId,
        note,
        createdByStaffId: session.userId,
      },
      createFollowUpRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The task could not be created.";
    redirect(`/enquiries/${enquiryId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/enquiries/${enquiryId}`);
  redirect(`/enquiries/${enquiryId}`);
}

export async function completeTaskAction(formData: FormData) {
  const session = await requireStaffSession();
  const enquiryId = readFormString(formData, "enquiryId");
  const taskId = readFormString(formData, "taskId");
  const expectedVersion = Number(readFormString(formData, "version"));

  try {
    await completeTask(
      { organizationId: session.organizationId, taskId, expectedVersion },
      createFollowUpRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The task could not be updated.";
    redirect(`/enquiries/${enquiryId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/enquiries/${enquiryId}`);
  redirect(`/enquiries/${enquiryId}`);
}

export async function reopenTaskAction(formData: FormData) {
  const session = await requireStaffSession();
  const enquiryId = readFormString(formData, "enquiryId");
  const taskId = readFormString(formData, "taskId");
  const expectedVersion = Number(readFormString(formData, "version"));

  try {
    await reopenTask(
      { organizationId: session.organizationId, taskId, expectedVersion },
      createFollowUpRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The task could not be updated.";
    redirect(`/enquiries/${enquiryId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/enquiries/${enquiryId}`);
  redirect(`/enquiries/${enquiryId}`);
}

export async function archiveEnquiryAction(formData: FormData) {
  const session = await requireStaffSession();
  const enquiryId = readFormString(formData, "enquiryId");
  const expectedVersion = Number(readFormString(formData, "version"));

  try {
    await archiveEnquiry(
      { actor: { organizationId: session.organizationId, role: session.role }, enquiryId, expectedVersion },
      createEnquiryRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Enquiry could not be archived.";
    redirect(`/enquiries/${enquiryId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/enquiries");
  redirect("/enquiries");
}

export async function restoreEnquiryAction(formData: FormData) {
  const session = await requireStaffSession();
  const enquiryId = readFormString(formData, "enquiryId");
  const expectedVersion = Number(readFormString(formData, "version"));

  try {
    await restoreEnquiry(
      { actor: { organizationId: session.organizationId, role: session.role }, enquiryId, expectedVersion },
      createEnquiryRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Enquiry could not be restored.";
    redirect(`/enquiries/${enquiryId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/enquiries/${enquiryId}`);
  redirect(`/enquiries/${enquiryId}`);
}
