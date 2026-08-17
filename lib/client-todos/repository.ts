import "server-only";

import { and, asc, eq, isNull } from "drizzle-orm";
import { getDatabase } from "@/db";
import { clients, clientTasks, staffProfiles } from "@/db/schema";
import type { ClientTodoRepository } from "@/lib/client-todos/service";

export function createClientTodoRepository(): ClientTodoRepository {
  const db = getDatabase();
  return {
    async getClientSummary(organizationId, clientId) {
      const [row] = await db
        .select({ id: clients.id })
        .from(clients)
        .where(and(eq(clients.organizationId, organizationId), eq(clients.id, clientId), isNull(clients.archivedAt)))
        .limit(1);
      return row ?? null;
    },
    async createTask(input) {
      const [row] = await db
        .insert(clientTasks)
        .values({
          organizationId: input.organizationId,
          clientId: input.clientId,
          title: input.title,
          dueDate: input.dueDate,
          assignedToStaffId: input.assignedToStaffId,
          note: input.note || "",
          createdByStaffId: input.createdByStaffId,
        })
        .returning({ id: clientTasks.id });
      return row;
    },
    async getTask(organizationId, taskId) {
      const [row] = await db
        .select({ id: clientTasks.id, version: clientTasks.version, status: clientTasks.status })
        .from(clientTasks)
        .where(and(eq(clientTasks.organizationId, organizationId), eq(clientTasks.id, taskId)))
        .limit(1);
      return row ?? null;
    },
    async setTaskStatus(input) {
      const rows = await db
        .update(clientTasks)
        .set({ status: input.status, version: input.nextVersion, updatedAt: new Date() })
        .where(
          and(
            eq(clientTasks.organizationId, input.organizationId),
            eq(clientTasks.id, input.taskId),
            eq(clientTasks.version, input.expectedVersion),
          ),
        )
        .returning({ id: clientTasks.id });
      if (!rows.length) throw new Error("This To-do changed. Reload and try again.");
    },
  };
}

export async function listClientTasks(organizationId: string, clientId: string) {
  const db = getDatabase();
  return db
    .select({
      id: clientTasks.id,
      title: clientTasks.title,
      dueDate: clientTasks.dueDate,
      note: clientTasks.note,
      status: clientTasks.status,
      version: clientTasks.version,
      assignedToName: staffProfiles.fullName,
    })
    .from(clientTasks)
    .innerJoin(staffProfiles, eq(staffProfiles.id, clientTasks.assignedToStaffId))
    .where(and(eq(clientTasks.organizationId, organizationId), eq(clientTasks.clientId, clientId), isNull(clientTasks.archivedAt)))
    .orderBy(asc(clientTasks.dueDate), asc(clientTasks.createdAt));
}
