"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaffSession } from "@/lib/auth/session";
import { createMeasurementFieldDefinitionRepository } from "@/lib/measurement-field-definitions/repository";
import {
  archiveMeasurementFieldDefinition,
  createMeasurementFieldDefinition,
  restoreMeasurementFieldDefinition,
} from "@/lib/measurement-field-definitions/service";
import { readFormString } from "@/lib/forms/read-string";

function safeReturnPath(value: string, fallback: string): string {
  return value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

export async function createMeasurementFieldDefinitionAction(formData: FormData) {
  const session = await requireStaffSession();
  const name = readFormString(formData, "name");
  const unit = readFormString(formData, "unit");
  const sortOrder = Number(readFormString(formData, "sortOrder"));
  const returnTo = safeReturnPath(readFormString(formData, "returnTo"), "/settings/measurement-fields");

  try {
    await createMeasurementFieldDefinition(
      { actor: { role: session.role }, organizationId: session.organizationId, name, unit, sortOrder },
      createMeasurementFieldDefinitionRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The measurement field could not be created.";
    const separator = returnTo.includes("?") ? "&" : "?";
    redirect(`${returnTo}${separator}error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/settings/measurement-fields");
  revalidatePath(returnTo);
  redirect(returnTo);
}

export async function archiveMeasurementFieldDefinitionAction(formData: FormData) {
  const session = await requireStaffSession();
  const fieldDefinitionId = readFormString(formData, "fieldDefinitionId");
  const expectedVersion = Number(readFormString(formData, "version"));

  try {
    await archiveMeasurementFieldDefinition(
      { actor: { role: session.role }, organizationId: session.organizationId, fieldDefinitionId, expectedVersion },
      createMeasurementFieldDefinitionRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The measurement field could not be updated.";
    redirect(`/settings/measurement-fields?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/settings/measurement-fields");
  redirect("/settings/measurement-fields");
}

export async function restoreMeasurementFieldDefinitionAction(formData: FormData) {
  const session = await requireStaffSession();
  const fieldDefinitionId = readFormString(formData, "fieldDefinitionId");
  const expectedVersion = Number(readFormString(formData, "version"));

  try {
    await restoreMeasurementFieldDefinition(
      { actor: { role: session.role }, organizationId: session.organizationId, fieldDefinitionId, expectedVersion },
      createMeasurementFieldDefinitionRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The measurement field could not be updated.";
    redirect(`/settings/measurement-fields?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/settings/measurement-fields");
  redirect("/settings/measurement-fields");
}
