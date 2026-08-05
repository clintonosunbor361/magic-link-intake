import { resolveVersionedUpdate } from "@/lib/domain/concurrency";

export type EnquiryTaskStatus = "open" | "done";

export type FollowUpRepository = {
  getEnquirySummary(organizationId: string, enquiryId: string): Promise<{ id: string } | null>;
  addNote(input: {
    organizationId: string;
    enquiryId: string;
    note: string;
    occurredOn: string;
    nextFollowUpDate: string | null;
    createdByStaffId: string;
  }): Promise<{ id: string }>;
  createTask(input: {
    organizationId: string;
    enquiryId: string;
    title: string;
    dueDate: string;
    assignedToStaffId: string;
    note: string;
    createdByStaffId: string;
  }): Promise<{ id: string }>;
  getTask(
    organizationId: string,
    taskId: string,
  ): Promise<{ id: string; version: number; status: EnquiryTaskStatus } | null>;
  setTaskStatus(input: {
    organizationId: string;
    taskId: string;
    status: EnquiryTaskStatus;
    expectedVersion: number;
    nextVersion: number;
  }): Promise<void>;
};

export async function addFollowUpNote(
  input: {
    organizationId: string;
    enquiryId: string;
    note: string;
    occurredOn: string;
    nextFollowUpDate: string | null;
    createdByStaffId: string;
  },
  repository: FollowUpRepository,
) {
  if (!input.note.trim()) throw new Error("Note is required.");
  const enquiry = await repository.getEnquirySummary(input.organizationId, input.enquiryId);
  if (!enquiry) throw new Error("Enquiry was not found.");

  return repository.addNote(input);
}

export async function createTask(
  input: {
    organizationId: string;
    enquiryId: string;
    title: string;
    dueDate: string;
    assignedToStaffId: string;
    note: string;
    createdByStaffId: string;
  },
  repository: FollowUpRepository,
) {
  if (!input.title.trim()) throw new Error("Task title is required.");
  if (!input.dueDate) throw new Error("Due date is required.");
  if (!input.assignedToStaffId) throw new Error("Assign this task to a Staff Member.");

  const enquiry = await repository.getEnquirySummary(input.organizationId, input.enquiryId);
  if (!enquiry) throw new Error("Enquiry was not found.");

  return repository.createTask(input);
}

export async function completeTask(
  input: { organizationId: string; taskId: string; expectedVersion: number },
  repository: FollowUpRepository,
) {
  return setTaskStatus(input, "done", repository);
}

export async function reopenTask(
  input: { organizationId: string; taskId: string; expectedVersion: number },
  repository: FollowUpRepository,
) {
  return setTaskStatus(input, "open", repository);
}

async function setTaskStatus(
  input: { organizationId: string; taskId: string; expectedVersion: number },
  status: EnquiryTaskStatus,
  repository: FollowUpRepository,
) {
  const task = await repository.getTask(input.organizationId, input.taskId);
  if (!task) throw new Error("Task was not found.");

  const version = resolveVersionedUpdate({
    expectedVersion: input.expectedVersion,
    currentVersion: task.version,
  });
  if (!version.ok) throw new Error("This Task changed. Reload and try again.");

  await repository.setTaskStatus({
    organizationId: input.organizationId,
    taskId: input.taskId,
    status,
    expectedVersion: input.expectedVersion,
    nextVersion: version.nextVersion,
  });

  return { ok: true as const, nextVersion: version.nextVersion };
}
