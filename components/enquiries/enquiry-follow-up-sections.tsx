"use client";

import { useState } from "react";
import { CalendarPlus, MessageSquarePlus } from "lucide-react";
import {
  addFollowUpNoteAction,
  completeTaskAction,
  createTaskAction,
  reopenTaskAction,
} from "@/app/actions/enquiries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

type StaffOption = {
  userId: string;
  fullName: string;
};

type NoteView = {
  id: string;
  note: string;
  createdByName: string | null;
  createdAtLabel: string;
  nextFollowUpDateLabel: string | null;
};

type TaskView = {
  id: string;
  title: string;
  dueDateLabel: string;
  status: string;
  version: number;
  assignedToName: string | null;
};

export function FollowUpNotesSection({
  enquiryId,
  notes,
  canAdd,
}: {
  enquiryId: string;
  notes: NoteView[];
  canAdd: boolean;
}) {
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h2 className="section-title">Follow-up notes</h2>
        {canAdd ? (
          <Button type="button" variant={open ? "default" : "outline"} onClick={() => setOpen((value) => !value)} className="gap-2">
            <MessageSquarePlus size={16} aria-hidden="true" />
            Add note
          </Button>
        ) : null}
      </div>

      {open ? (
        <form action={addFollowUpNoteAction} className="mt-4 space-y-3 rounded-[0.95rem] border border-kuartz-line bg-[#fbfaf7] p-4 shadow-[0_18px_48px_rgba(24,24,38,0.08)]">
          <input type="hidden" name="enquiryId" value={enquiryId} />
          <label className="form-group">
            <span>Note</span>
            <textarea
              name="note"
              required
              className="min-h-[4.5rem] w-full rounded-[0.8rem] border border-kuartz-control bg-white/70 px-3.5 py-3 text-sm text-kuartz-ink outline-none focus:border-[#88925f] focus:bg-white focus:ring-4 focus:ring-kuartz-lime/20"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="form-group">
              <span>Date</span>
              <Input type="date" name="occurredOn" defaultValue={today} required />
            </label>
            <label className="form-group">
              <span>Next follow-up <span className="font-normal text-kuartz-secondary">(optional)</span></span>
              <Input type="date" name="nextFollowUpDate" />
            </label>
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save note</Button>
          </div>
        </form>
      ) : null}

      <div className="mt-4 space-y-3 border-y border-kuartz-line py-4">
        {notes.length ? (
          notes.map((note) => (
            <div key={note.id} className="border-b border-kuartz-lineSoft pb-3 last:border-none last:pb-0">
              <p className="text-sm text-kuartz-ink">{note.note}</p>
              <p className="mt-1 text-xs text-kuartz-secondary">
                {note.createdByName ?? "Staff"} - {note.createdAtLabel}
                {note.nextFollowUpDateLabel ? ` - Next follow-up ${note.nextFollowUpDateLabel}` : ""}
              </p>
            </div>
          ))
        ) : (
          <p className="py-4 text-sm text-kuartz-secondary">No follow-up notes yet.</p>
        )}
      </div>
    </div>
  );
}

export function TasksSection({
  enquiryId,
  tasks,
  staff,
  currentUserId,
  canAdd,
}: {
  enquiryId: string;
  tasks: TaskView[];
  staff: StaffOption[];
  currentUserId: string;
  canAdd: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h2 className="section-title">Tasks</h2>
        {canAdd ? (
          <Button type="button" variant={open ? "default" : "outline"} onClick={() => setOpen((value) => !value)} className="gap-2">
            <CalendarPlus size={16} aria-hidden="true" />
            Add task
          </Button>
        ) : null}
      </div>

      {open ? (
        <form action={createTaskAction} className="mt-4 space-y-3 rounded-[0.95rem] border border-kuartz-line bg-[#fbfaf7] p-4 shadow-[0_18px_48px_rgba(24,24,38,0.08)]">
          <input type="hidden" name="enquiryId" value={enquiryId} />
          <label className="form-group">
            <span>Task title</span>
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
            <Input name="note" />
          </label>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save task</Button>
          </div>
        </form>
      ) : null}

      <div className="mt-4 space-y-3 border-y border-kuartz-line py-4">
        {tasks.length ? (
          tasks.map((task) => (
            <div key={task.id} className="flex items-center justify-between gap-4 border-b border-kuartz-lineSoft pb-3 last:border-none last:pb-0">
              <div>
                <p className={`text-sm font-medium ${task.status === "done" ? "text-kuartz-secondary line-through" : "text-kuartz-ink"}`}>
                  {task.title}
                </p>
                <p className="mt-1 text-xs text-kuartz-secondary">
                  Due {task.dueDateLabel} - {task.assignedToName ?? "Unassigned"}
                </p>
              </div>
              <form action={task.status === "done" ? reopenTaskAction : completeTaskAction}>
                <input type="hidden" name="enquiryId" value={enquiryId} />
                <input type="hidden" name="taskId" value={task.id} />
                <input type="hidden" name="version" value={task.version} />
                <Button type="submit" variant="outline">
                  {task.status === "done" ? "Reopen" : "Mark done"}
                </Button>
              </form>
            </div>
          ))
        ) : (
          <p className="py-4 text-sm text-kuartz-secondary">No tasks yet.</p>
        )}
      </div>
    </div>
  );
}
