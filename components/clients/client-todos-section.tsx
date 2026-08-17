import { CheckSquare, SquarePlus } from "lucide-react";
import {
  completeClientTaskAction,
  createClientTaskAction,
  reopenClientTaskAction,
} from "@/app/actions/client-todos";
import { Button } from "@/components/ui/button";
import { FormDisclosure } from "@/components/ui/form-disclosure";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

type StaffOption = {
  userId: string;
  fullName: string;
};

type ClientTaskView = {
  id: string;
  title: string;
  dueDate: string;
  note: string;
  status: "open" | "done";
  version: number;
  assignedToName: string;
};

export function ClientTodosSection({
  clientId,
  tasks,
  staff,
  currentUserId,
}: {
  clientId: string;
  tasks: ClientTaskView[];
  staff: StaffOption[];
  currentUserId: string;
}) {
  return (
    <div>
      <FormDisclosure title="To-dos" buttonLabel="Add To-do">
        <form action={createClientTaskAction} className="space-y-3 rounded-[0.95rem] border border-kuartz-line bg-[#fbfaf7] p-4 shadow-[0_18px_48px_rgba(24,24,38,0.08)]">
          <input type="hidden" name="clientId" value={clientId} />
          <label className="form-group">
            <span>Title</span>
            <Input name="title" required />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="form-group">
              <span>Due date</span>
              <Input type="date" name="dueDate" required />
            </label>
            <label className="form-group">
              <span>Assign to</span>
              <NativeSelect name="assignedToStaffId" defaultValue={currentUserId}>
                {staff.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.fullName}
                  </option>
                ))}
              </NativeSelect>
            </label>
          </div>
          <label className="form-group">
            <span>Note <span className="font-normal text-kuartz-secondary">(optional)</span></span>
            <textarea
              name="note"
              className="min-h-[4.5rem] w-full rounded-[0.8rem] border border-kuartz-control bg-white/70 px-3.5 py-3 text-sm text-kuartz-ink outline-none focus:border-[#88925f] focus:bg-white focus:ring-4 focus:ring-kuartz-lime/20"
            />
          </label>
          <Button type="submit" variant="outline" className="gap-2">
            <SquarePlus size={16} aria-hidden="true" />
            Save To-do
          </Button>
        </form>
      </FormDisclosure>

      <div className="mt-4 divide-y divide-kuartz-line border-y border-kuartz-line">
        {tasks.length ? (
          tasks.map((task) => (
            <div key={task.id} className="grid gap-3 py-4 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
              <div>
                <p className={`font-semibold ${task.status === "done" ? "text-kuartz-secondary line-through" : "text-kuartz-ink"}`}>
                  {task.title}
                </p>
                <p className="mt-1 text-xs text-kuartz-secondary">
                  Due {task.dueDate} - {task.assignedToName}
                </p>
                {task.note ? <p className="mt-2 text-sm leading-6 text-kuartz-secondary">{task.note}</p> : null}
              </div>
              <form action={task.status === "done" ? reopenClientTaskAction : completeClientTaskAction}>
                <input type="hidden" name="clientId" value={clientId} />
                <input type="hidden" name="taskId" value={task.id} />
                <input type="hidden" name="version" value={task.version} />
                <Button type="submit" variant="outline" className="gap-2">
                  <CheckSquare size={16} aria-hidden="true" />
                  {task.status === "done" ? "Reopen" : "Mark done"}
                </Button>
              </form>
            </div>
          ))
        ) : (
          <p className="py-6 text-sm text-kuartz-muted">No To-dos yet.</p>
        )}
      </div>
    </div>
  );
}
