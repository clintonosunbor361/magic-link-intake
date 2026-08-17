import { resolveVersionedUpdate } from "@/lib/domain/concurrency";

export type ClientTaskStatus = "open" | "done";

export type ClientTodoRepository = {
  getClientSummary(organizationId: string, clientId: string): Promise<{ id: string } | null>;
  createTask(input: {
    organizationId: string;
    clientId: string;
    title: string;
    dueDate: string;
    assignedToStaffId: string;
    note: string;
    createdByStaffId: string;
  }): Promise<{ id: string }>;
  getTask(organizationId: string, taskId: string): Promise<{ id: string; version: number; status: ClientTaskStatus } | null>;
  setTaskStatus(input: {
    organizationId: string;
    taskId: string;
    status: ClientTaskStatus;
    expectedVersion: number;
    nextVersion: number;
  }): Promise<void>;
};

export async function createClientTask(
  input: {
    organizationId: string;
    clientId: string;
    title: string;
    dueDate: string;
    assignedToStaffId: string;
    note: string;
    createdByStaffId: string;
  },
  repository: ClientTodoRepository,
) {
  if (!input.title.trim()) throw new Error("To-do title is required.");
  if (!input.dueDate) throw new Error("Due date is required.");
  if (!input.assignedToStaffId) throw new Error("Assign this to-do to a Staff Member.");

  const client = await repository.getClientSummary(input.organizationId, input.clientId);
  if (!client) throw new Error("Client was not found.");

  return repository.createTask(input);
}

export async function completeClientTask(
  input: { organizationId: string; taskId: string; expectedVersion: number },
  repository: ClientTodoRepository,
) {
  return setTaskStatus(input, "done", repository);
}

export async function reopenClientTask(
  input: { organizationId: string; taskId: string; expectedVersion: number },
  repository: ClientTodoRepository,
) {
  return setTaskStatus(input, "open", repository);
}

async function setTaskStatus(
  input: { organizationId: string; taskId: string; expectedVersion: number },
  status: ClientTaskStatus,
  repository: ClientTodoRepository,
) {
  const task = await repository.getTask(input.organizationId, input.taskId);
  if (!task) throw new Error("To-do was not found.");

  const version = resolveVersionedUpdate({
    expectedVersion: input.expectedVersion,
    currentVersion: task.version,
  });
  if (!version.ok) throw new Error("This To-do changed. Reload and try again.");

  await repository.setTaskStatus({
    organizationId: input.organizationId,
    taskId: input.taskId,
    status,
    expectedVersion: input.expectedVersion,
    nextVersion: version.nextVersion,
  });

  return { ok: true as const, nextVersion: version.nextVersion };
}
