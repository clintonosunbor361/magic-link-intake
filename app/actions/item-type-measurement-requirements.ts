"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaffSession } from "@/lib/auth/session";
import { readFormString } from "@/lib/forms/read-string";
import { createMeasurementRequirementRepository } from "@/lib/item-type-measurement-requirements/repository";
import {
  archiveMeasurementRequirement,
  createMeasurementRequirement,
  restoreMeasurementRequirement,
} from "@/lib/item-type-measurement-requirements/service";

export async function createMeasurementRequirementAction(formData: FormData) {
  const session = await requireStaffSession();
  const itemTypeId = readFormString(formData, "itemTypeId");
  const fieldDefinitionId = readFormString(formData, "fieldDefinitionId");

  try {
    await createMeasurementRequirement(
      { actor: { role: session.role }, organizationId: session.organizationId, itemTypeId, fieldDefinitionId },
      createMeasurementRequirementRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The measurement requirement could not be created.";
    redirect(`/settings/measurement-requirements?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/settings/measurement-requirements");
  redirect("/settings/measurement-requirements");
}

export async function archiveMeasurementRequirementAction(formData: FormData) {
  const session = await requireStaffSession();
  const requirementId = readFormString(formData, "requirementId");
  const expectedVersion = Number(readFormString(formData, "version"));

  try {
    await archiveMeasurementRequirement(
      { actor: { role: session.role }, organizationId: session.organizationId, requirementId, expectedVersion },
      createMeasurementRequirementRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The measurement requirement could not be updated.";
    redirect(`/settings/measurement-requirements?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/settings/measurement-requirements");
  redirect("/settings/measurement-requirements");
}

export async function restoreMeasurementRequirementAction(formData: FormData) {
  const session = await requireStaffSession();
  const requirementId = readFormString(formData, "requirementId");
  const expectedVersion = Number(readFormString(formData, "version"));

  try {
    await restoreMeasurementRequirement(
      { actor: { role: session.role }, organizationId: session.organizationId, requirementId, expectedVersion },
      createMeasurementRequirementRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The measurement requirement could not be updated.";
    redirect(`/settings/measurement-requirements?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/settings/measurement-requirements");
  redirect("/settings/measurement-requirements");
}
