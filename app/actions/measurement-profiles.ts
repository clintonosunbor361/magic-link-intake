"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaffSession } from "@/lib/auth/session";
import { readFormString } from "@/lib/forms/read-string";
import { createMeasurementAttachmentStorage, createMeasurementProfileAttachmentRepository, createMeasurementProfileRepository } from "@/lib/measurement-profiles/repository";
import { archiveMeasurementProfile, restoreMeasurementProfile, setMeasurementValue } from "@/lib/measurement-profiles/service";
import {
  archiveMeasurementProfileAttachment,
  createMeasurementProfileAttachment,
  restoreMeasurementProfileAttachment,
} from "@/lib/measurement-profiles/attachments-service";

async function readUploadedFile(formData: FormData): Promise<{ buffer: Buffer; declaredMimeType: string }> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Choose a file to upload.");
  return { buffer: Buffer.from(await file.arrayBuffer()), declaredMimeType: file.type };
}

export async function setMeasurementValueAction(formData: FormData) {
  const session = await requireStaffSession();
  const clientId = readFormString(formData, "clientId");
  const measurementProfileId = readFormString(formData, "measurementProfileId");
  const fieldDefinitionId = readFormString(formData, "fieldDefinitionId");
  const expectedVersion = Number(readFormString(formData, "version"));

  try {
    await setMeasurementValue(
      {
        organizationId: session.organizationId,
        measurementProfileId,
        fieldDefinitionId,
        value: readFormString(formData, "value"),
        note: readFormString(formData, "note") || null,
        staffId: session.userId,
        expectedVersion,
      },
      createMeasurementProfileRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The measurement could not be saved.";
    redirect(`/clients/${clientId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}

export async function setMeasurementValuesAction(formData: FormData) {
  const session = await requireStaffSession();
  const clientId = readFormString(formData, "clientId");
  const measurementProfileId = readFormString(formData, "measurementProfileId");
  const fieldDefinitionIds = formData.getAll("fieldDefinitionId").map(String);
  const repository = createMeasurementProfileRepository();

  try {
    for (const fieldDefinitionId of fieldDefinitionIds) {
      const value = readFormString(formData, `value:${fieldDefinitionId}`);
      const previousValue = readFormString(formData, `previousValue:${fieldDefinitionId}`);
      const note = readFormString(formData, `note:${fieldDefinitionId}`);
      const expectedVersion = Number(readFormString(formData, `version:${fieldDefinitionId}`));

      if (!value.trim() || value.trim() === previousValue.trim()) continue;

      await setMeasurementValue(
        {
          organizationId: session.organizationId,
          measurementProfileId,
          fieldDefinitionId,
          value,
          note: note || null,
          staffId: session.userId,
          expectedVersion,
        },
        repository,
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "The measurements could not be saved.";
    redirect(`/clients/${clientId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}

export async function archiveMeasurementProfileAction(formData: FormData) {
  const session = await requireStaffSession();
  const clientId = readFormString(formData, "clientId");
  const measurementProfileId = readFormString(formData, "measurementProfileId");
  const expectedVersion = Number(readFormString(formData, "version"));

  try {
    await archiveMeasurementProfile(
      { actor: { organizationId: session.organizationId, role: session.role }, measurementProfileId, expectedVersion },
      createMeasurementProfileRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The measurement profile could not be updated.";
    redirect(`/clients/${clientId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}

export async function restoreMeasurementProfileAction(formData: FormData) {
  const session = await requireStaffSession();
  const clientId = readFormString(formData, "clientId");
  const measurementProfileId = readFormString(formData, "measurementProfileId");
  const expectedVersion = Number(readFormString(formData, "version"));

  try {
    await restoreMeasurementProfile(
      { actor: { organizationId: session.organizationId, role: session.role }, measurementProfileId, expectedVersion },
      createMeasurementProfileRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The measurement profile could not be updated.";
    redirect(`/clients/${clientId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}

export async function uploadMeasurementProfileAttachmentAction(formData: FormData) {
  const session = await requireStaffSession();
  const clientId = readFormString(formData, "clientId");
  const measurementProfileId = readFormString(formData, "measurementProfileId");

  try {
    const upload = await readUploadedFile(formData);
    await createMeasurementProfileAttachment(
      { organizationId: session.organizationId, measurementProfileId, uploadedByStaffId: session.userId },
      upload,
      createMeasurementProfileAttachmentRepository(),
      createMeasurementAttachmentStorage(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The attachment could not be uploaded.";
    redirect(`/clients/${clientId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}

export async function archiveMeasurementProfileAttachmentAction(formData: FormData) {
  const session = await requireStaffSession();
  const clientId = readFormString(formData, "clientId");
  const attachmentId = readFormString(formData, "attachmentId");
  const expectedVersion = Number(readFormString(formData, "version"));

  try {
    await archiveMeasurementProfileAttachment(
      { actor: { organizationId: session.organizationId, role: session.role }, attachmentId, expectedVersion },
      createMeasurementProfileAttachmentRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The attachment could not be updated.";
    redirect(`/clients/${clientId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}

export async function restoreMeasurementProfileAttachmentAction(formData: FormData) {
  const session = await requireStaffSession();
  const clientId = readFormString(formData, "clientId");
  const attachmentId = readFormString(formData, "attachmentId");
  const expectedVersion = Number(readFormString(formData, "version"));

  try {
    await restoreMeasurementProfileAttachment(
      { actor: { organizationId: session.organizationId, role: session.role }, attachmentId, expectedVersion },
      createMeasurementProfileAttachmentRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The attachment could not be updated.";
    redirect(`/clients/${clientId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}
