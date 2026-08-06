"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaffSession } from "@/lib/auth/session";
import { archiveClient, restoreClient, updateClientIdentity } from "@/lib/clients/service";
import { createClientRepository } from "@/lib/clients/repository";
import { readFormString } from "@/lib/forms/read-string";

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
