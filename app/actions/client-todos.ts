"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaffSession } from "@/lib/auth/session";
import { createClientTask, completeClientTask, reopenClientTask } from "@/lib/client-todos/service";
import { createClientTodoRepository } from "@/lib/client-todos/repository";
import { readFormString } from "@/lib/forms/read-string";

export async function createClientTaskAction(formData: FormData) {
  const session = await requireStaffSession();
  const clientId = readFormString(formData, "clientId");

  try {
    await createClientTask(
      {
        organizationId: session.organizationId,
        clientId,
        title: readFormString(formData, "title"),
        dueDate: readFormString(formData, "dueDate"),
        assignedToStaffId: readFormString(formData, "assignedToStaffId") || session.userId,
        note: readFormString(formData, "note"),
        createdByStaffId: session.userId,
      },
      createClientTodoRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The To-do could not be created.";
    redirect(`/clients/${clientId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}

export async function completeClientTaskAction(formData: FormData) {
  return setClientTaskStatus(formData, "complete");
}

export async function reopenClientTaskAction(formData: FormData) {
  return setClientTaskStatus(formData, "reopen");
}

async function setClientTaskStatus(formData: FormData, action: "complete" | "reopen") {
  const session = await requireStaffSession();
  const clientId = readFormString(formData, "clientId");
  const taskId = readFormString(formData, "taskId");
  const expectedVersion = Number(readFormString(formData, "version"));

  try {
    const repository = createClientTodoRepository();
    if (action === "complete") {
      await completeClientTask({ organizationId: session.organizationId, taskId, expectedVersion }, repository);
    } else {
      await reopenClientTask({ organizationId: session.organizationId, taskId, expectedVersion }, repository);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "The To-do could not be updated.";
    redirect(`/clients/${clientId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}
