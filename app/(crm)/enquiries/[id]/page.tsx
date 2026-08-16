import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  addFollowUpNoteAction,
  archiveEnquiryAction,
  completeTaskAction,
  createTaskAction,
  reopenTaskAction,
  restoreEnquiryAction,
} from "@/app/actions/enquiries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { requireStaffSession } from "@/lib/auth/session";
import { mayArchive, mayRestore } from "@/lib/domain/record-lifecycle";
import { getConvertedRecordReferences, getEnquiry, listFollowUpNotes, listTasks } from "@/lib/enquiries/repository";
import { listStaffMembers } from "@/lib/team/repository";

const dateFormatter = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" });
const dayFormatter = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" });

export default async function EnquiryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireStaffSession();
  const { id } = await params;
  const { error } = await searchParams;

  const enquiry = await getEnquiry(session.organizationId, id);
  if (!enquiry) notFound();

  const [notes, tasks, staff, convertedReferences] = await Promise.all([
    listFollowUpNotes(id),
    listTasks(id),
    listStaffMembers(session.organizationId),
    enquiry.convertedClientId && enquiry.convertedOrderId
      ? getConvertedRecordReferences(session.organizationId, enquiry.convertedClientId, enquiry.convertedOrderId)
      : Promise.resolve(null),
  ]);

  const owner = staff.find((member) => member.userId === enquiry.ownerStaffId);
  const isArchived = Boolean(enquiry.archivedAt);
  const isConverted = Boolean(enquiry.convertedAt);

  return (
    <div>
      <Button asChild variant="ghost" className="mb-3 -ml-2 gap-2">
        <Link href="/enquiries">
          <ArrowLeft size={16} aria-hidden="true" />
          Back to Enquiries
        </Link>
      </Button>
      <header className="border-b border-kuartz-line pb-8">
        <p className="eyebrow">Enquiry</p>
        <h1 className="page-title">{enquiry.fullName}</h1>
        <p className="page-description">
          {enquiry.channel === "external_form" ? "Submitted via intake link" : "Created by staff"} ·{" "}
          {dateFormatter.format(enquiry.createdAt)}
        </p>
      </header>

      {error ? (
        <p className="form-alert mt-6" role="alert">
          {error}
        </p>
      ) : null}

      {isConverted ? (
        <p className="form-success mt-6">
          {convertedReferences ? (
            <>
              Converted into{" "}
              <Link href={`/clients/${enquiry.convertedClientId}`} className="font-semibold underline underline-offset-4">
                Client #{String(convertedReferences.clientNumber).padStart(3, "0")}
              </Link>{" "}
              /{" "}
              <Link href={`/orders/${enquiry.convertedOrderId}`} className="font-semibold underline underline-offset-4">
                Order #{String(convertedReferences.orderNumber).padStart(3, "0")}
              </Link>
              .
            </>
          ) : "Converted into a Client and Active Order."}
        </p>
      ) : null}
      {isArchived ? <p className="form-alert mt-6">This Enquiry is archived.</p> : null}

      <section className="mt-9 grid gap-10 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-8">
          <div>
            <h2 className="section-title">Contact details</h2>
            <dl className="mt-4 grid gap-4 border-y border-kuartz-line py-5 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-kuartz-secondary">Primary phone</dt>
                <dd className="mt-1 text-sm text-kuartz-ink">{enquiry.primaryPhone}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-kuartz-secondary">WhatsApp</dt>
                <dd className="mt-1 text-sm text-kuartz-ink">{enquiry.whatsappPhone || "Same as primary"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-kuartz-secondary">Email</dt>
                <dd className="mt-1 text-sm text-kuartz-ink">{enquiry.email || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-kuartz-secondary">Preferred contact</dt>
                <dd className="mt-1 text-sm text-kuartz-ink">{enquiry.preferredContactChannel}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-kuartz-secondary">Event type</dt>
                <dd className="mt-1 text-sm text-kuartz-ink">{enquiry.eventType}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-kuartz-secondary">Budget range</dt>
                <dd className="mt-1 text-sm text-kuartz-ink">{enquiry.budgetRange || "—"}</dd>
              </div>
              {enquiry.channel === "internal_staff" ? (
                <>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-kuartz-secondary">Lead source</dt>
                    <dd className="mt-1 text-sm text-kuartz-ink">{enquiry.leadSource || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-kuartz-secondary">Primary owner</dt>
                    <dd className="mt-1 text-sm text-kuartz-ink">{owner?.fullName || "Unassigned"}</dd>
                  </div>
                </>
              ) : null}
            </dl>
            {enquiry.brief ? <p className="mt-4 text-sm leading-6 text-kuartz-secondary">{enquiry.brief}</p> : null}
            {enquiry.channel === "internal_staff" && enquiry.internalNotes ? (
              <p className="mt-4 rounded-[0.8rem] border border-kuartz-line bg-white/60 p-4 text-sm leading-6 text-kuartz-secondary">
                <span className="font-semibold text-kuartz-ink">Internal notes: </span>
                {enquiry.internalNotes}
              </p>
            ) : null}
          </div>

          <div>
            <h2 className="section-title">Follow-up notes</h2>
            <div className="mt-4 space-y-3 border-y border-kuartz-line py-4">
              {notes.length ? (
                notes.map((note) => (
                  <div key={note.id} className="border-b border-kuartz-lineSoft pb-3 last:border-none last:pb-0">
                    <p className="text-sm text-kuartz-ink">{note.note}</p>
                    <p className="mt-1 text-xs text-kuartz-secondary">
                      {note.createdByName ?? "Staff"} · {dateFormatter.format(note.createdAt)}
                      {note.nextFollowUpDate ? ` · Next follow-up ${dayFormatter.format(new Date(note.nextFollowUpDate))}` : ""}
                    </p>
                  </div>
                ))
              ) : (
                <p className="py-4 text-sm text-kuartz-secondary">No follow-up notes yet.</p>
              )}
            </div>
            <form action={addFollowUpNoteAction} className="mt-4 space-y-3">
              <input type="hidden" name="enquiryId" value={enquiry.id} />
              <label className="form-group">
                <span>Add a note</span>
                <textarea
                  name="note"
                  required
                  className="min-h-[4.5rem] w-full rounded-[0.8rem] border border-kuartz-control bg-white/70 px-3.5 py-3 text-sm text-kuartz-ink outline-none focus:border-[#88925f] focus:bg-white focus:ring-4 focus:ring-kuartz-lime/20"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="form-group">
                  <span>Date</span>
                  <Input type="date" name="occurredOn" defaultValue={new Date().toISOString().slice(0, 10)} required />
                </label>
                <label className="form-group">
                  <span>Next follow-up <span className="font-normal text-kuartz-secondary">(optional)</span></span>
                  <Input type="date" name="nextFollowUpDate" />
                </label>
              </div>
              <Button type="submit" variant="outline">
                Add note
              </Button>
            </form>
          </div>

          <div>
            <h2 className="section-title">Tasks</h2>
            <div className="mt-4 space-y-3 border-y border-kuartz-line py-4">
              {tasks.length ? (
                tasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between gap-4 border-b border-kuartz-lineSoft pb-3 last:border-none last:pb-0">
                    <div>
                      <p className={`text-sm font-medium ${task.status === "done" ? "text-kuartz-secondary line-through" : "text-kuartz-ink"}`}>
                        {task.title}
                      </p>
                      <p className="mt-1 text-xs text-kuartz-secondary">
                        Due {dayFormatter.format(new Date(task.dueDate))} · {task.assignedToName ?? "Unassigned"}
                      </p>
                    </div>
                    <form action={task.status === "done" ? reopenTaskAction : completeTaskAction}>
                      <input type="hidden" name="enquiryId" value={enquiry.id} />
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
            <form action={createTaskAction} className="mt-4 space-y-3">
              <input type="hidden" name="enquiryId" value={enquiry.id} />
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
                  <NativeSelect name="assignedToStaffId" defaultValue={session.userId}>
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
              <Button type="submit" variant="outline">
                Add task
              </Button>
            </form>
          </div>
        </div>

        <aside className="space-y-4">
          {!isConverted && !isArchived ? (
            <Button asChild className="w-full">
              <Link href={`/enquiries/${enquiry.id}/convert`}>Convert to Client + Order</Link>
            </Button>
          ) : null}

          {!isArchived && mayArchive("enquiry", session.role) ? (
            <form action={archiveEnquiryAction}>
              <input type="hidden" name="enquiryId" value={enquiry.id} />
              <input type="hidden" name="version" value={enquiry.version} />
              <Button type="submit" variant="outline" className="w-full">
                Archive Enquiry
              </Button>
            </form>
          ) : null}

          {isArchived && mayRestore("enquiry", session.role) ? (
            <form action={restoreEnquiryAction}>
              <input type="hidden" name="enquiryId" value={enquiry.id} />
              <input type="hidden" name="version" value={enquiry.version} />
              <Button type="submit" variant="outline" className="w-full">
                Restore Enquiry
              </Button>
            </form>
          ) : null}
        </aside>
      </section>
    </div>
  );
}
