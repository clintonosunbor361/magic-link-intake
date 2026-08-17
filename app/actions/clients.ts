"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaffSession } from "@/lib/auth/session";
import { archiveClient, createClient, restoreClient, updateClientIdentity, type CreateClientResult } from "@/lib/clients/service";
import { createClientRepository } from "@/lib/clients/repository";
import { readFormString } from "@/lib/forms/read-string";
import { BUDGET_RANGES, CONTACT_CHANNELS, EVENT_TYPES } from "@/lib/intake-options";

function optionValue<T extends readonly string[]>(formData: FormData, key: string, allowed: T): T[number] {
  const value = readFormString(formData, key);
  if (!(allowed as readonly string[]).includes(value)) throw new Error(`Select a valid ${key}.`);
  return value as T[number];
}

export async function createClientAction(formData: FormData) {
  const session = await requireStaffSession();
  const whatsappSameAsPrimary = formData.get("whatsappSameAsPrimary") === "on";

  let result: CreateClientResult;
  try {
    result = await createClient(
      {
        actor: { organizationId: session.organizationId, role: session.role },
        client: {
          fullName: readFormString(formData, "fullName"),
          primaryPhone: readFormString(formData, "primaryPhone"),
          whatsappSameAsPrimary,
          whatsappPhone: readFormString(formData, "whatsappPhone"),
          email: readFormString(formData, "email"),
          preferredContactChannel: optionValue(formData, "preferredContactChannel", CONTACT_CHANNELS),
          eventType: optionValue(formData, "eventType", EVENT_TYPES),
          budgetRange: optionValue(formData, "budgetRange", BUDGET_RANGES),
          brief: readFormString(formData, "brief"),
          leadSource: readFormString(formData, "leadSource"),
          ownerStaffId: readFormString(formData, "ownerStaffId"),
          internalNotes: readFormString(formData, "internalNotes"),
          acknowledgedDuplicates: formData.get("acknowledgedDuplicates") === "on",
        },
      },
      createClientRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Client could not be created.";
    redirect(`/clients/new?error=${encodeURIComponent(message)}`);
  }

  if (!result.ok) {
    redirect("/clients/new?error=Potential+duplicate+contacts+were+found.+Review+them+and+confirm+to+continue.");
  }

  revalidatePath("/clients");
  redirect(`/clients/${result.clientId}`);
}

export async function updateClientAction(formData: FormData) {
  const session = await requireStaffSession();
  const clientId = readFormString(formData, "clientId");
  const expectedVersion = Number(readFormString(formData, "version"));

  try {
    await updateClientIdentity(
      {
        organizationId: session.organizationId,
        clientId,
        expectedVersion,
        fields: {
          fullName: readFormString(formData, "fullName"),
          primaryPhone: readFormString(formData, "primaryPhone"),
          whatsappPhone: readFormString(formData, "whatsappPhone"),
          email: readFormString(formData, "email"),
        },
      },
      createClientRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Client could not be updated.";
    redirect(`/clients/${clientId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}

export async function archiveClientAction(formData: FormData) {
  const session = await requireStaffSession();
  const clientId = readFormString(formData, "clientId");
  const expectedVersion = Number(readFormString(formData, "version"));

  try {
    await archiveClient(
      { actor: { organizationId: session.organizationId, role: session.role }, clientId, expectedVersion },
      createClientRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Client could not be archived.";
    redirect(`/clients/${clientId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}

export async function restoreClientAction(formData: FormData) {
  const session = await requireStaffSession();
  const clientId = readFormString(formData, "clientId");
  const expectedVersion = Number(readFormString(formData, "version"));

  try {
    await restoreClient(
      { actor: { organizationId: session.organizationId, role: session.role }, clientId, expectedVersion },
      createClientRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Client could not be restored.";
    redirect(`/clients/${clientId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}
