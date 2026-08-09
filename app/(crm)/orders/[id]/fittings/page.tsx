import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addFittingNoteAction,
  archiveFittingAction,
  changeFittingStatusAction,
  issueFittingConfirmationAction,
  rescheduleFittingAction,
  restoreFittingAction,
  scheduleFittingAction,
  updateFittingSummaryAction,
} from "@/app/actions/fittings";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { requireStaffSession } from "@/lib/auth/session";
import { listConfirmationsForSubject } from "@/lib/client-confirmations/repository";
import { mayArchive, mayRestore } from "@/lib/domain/record-lifecycle";
import {
  FITTING_SESSION_STATUSES,
  FITTING_STATUS_LABELS,
  isTerminalFittingStatus,
} from "@/lib/fittings/fitting";
import { listFittingHistory, listFittingNotes, listFittingSessionsForOrder } from "@/lib/fittings/repository";
import { getOrderWithLooksAndItems } from "@/lib/orders/repository";

const dateTimeFormatter = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" });
const textareaClass =
  "min-h-[3.5rem] w-full rounded-[0.8rem] border border-[#cfcec7] bg-white/70 px-3.5 py-3 text-sm text-[#171b36] outline-none focus:border-[#88925f] focus:bg-white focus:ring-4 focus:ring-[#d2ff67]/20";

function toDateTimeLocalValue(date: Date): string {
  return date.toISOString().slice(0, 16);
}

export default async function OrderFittingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireStaffSession();
  const [{ id }, query] = await Promise.all([params, searchParams]);

  const order = await getOrderWithLooksAndItems(session.organizationId, id);
  if (!order) notFound();

  const sessions = await listFittingSessionsForOrder(session.organizationId, id);
  const liveLooks = order.looks.filter((look) => !look.archivedAt);

  // Notes, history and confirmations are per session; the counts here are small by design.
  const detail = await Promise.all(
    sessions.map(async (fitting) => ({
      fitting,
      notes: await listFittingNotes(session.organizationId, fitting.id),
      history: await listFittingHistory(session.organizationId, fitting.id),
      confirmations: await listConfirmationsForSubject(session.organizationId, "fitting_session", fitting.id),
    })),
  );

  return (
    <div>
      <Link
        href={`/orders/${id}`}
        className="text-sm font-semibold text-[#50586c] underline-offset-4 transition-colors duration-200 hover:text-[#171b36] hover:underline"
      >
        ← {order.title}
      </Link>

      <header className="mt-4 border-b border-[#d9d8d1] pb-8">
        <p className="eyebrow">Fittings</p>
        <h1 className="page-title">Fitting sessions</h1>
        <p className="page-description">
          Notes here are internal and never leave the building. The client only ever sees the summary
          you write for them, and only once you send the confirmation link after the fitting.
        </p>
      </header>

      {query.error ? (
        <p className="form-alert mt-6" role="alert">
          {query.error}
        </p>
      ) : null}

      <section className="mt-9 grid gap-10 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-10">
          {detail.length ? (
            detail.map(({ fitting, notes, history, confirmations }) => {
              const terminal = isTerminalFittingStatus(fitting.status);
              return (
                <div key={fitting.id} className="border-t border-[#d9d8d1] pt-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="section-title">{dateTimeFormatter.format(fitting.scheduledAt)}</h2>
                    <span className="rounded-full border border-[#d9d8d1] bg-[#f6f6f3] px-2.5 py-0.5 text-xs font-semibold text-[#50586c]">
                      {FITTING_STATUS_LABELS[fitting.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[#767b89]">
                    {fitting.lookName ?? "Whole Order"}
                    {fitting.location ? ` · ${fitting.location}` : ""}
                  </p>
                  {fitting.archivedAt ? <p className="form-alert mt-3">This Fitting is archived.</p> : null}

                  {!terminal && !fitting.archivedAt ? (
                    <div className="mt-5 grid gap-5 sm:grid-cols-2">
                      <form action={rescheduleFittingAction} className="space-y-3">
                        <input type="hidden" name="orderId" value={id} />
                        <input type="hidden" name="sessionId" value={fitting.id} />
                        <input type="hidden" name="version" value={fitting.version} />
                        <h3 className="text-sm font-semibold text-[#272c45]">Reschedule</h3>
                        <label className="form-group">
                          <span className="text-xs">New date and time</span>
                          <Input
                            type="datetime-local"
                            name="scheduledAt"
                            defaultValue={toDateTimeLocalValue(fitting.scheduledAt)}
                            required
                          />
                        </label>
                        <label className="form-group">
                          <span className="text-xs">
                            Location <span className="font-normal text-[#50586c]">(optional)</span>
                          </span>
                          <Input name="location" defaultValue={fitting.location} maxLength={160} />
                        </label>
                        <label className="form-group">
                          <span className="text-xs">
                            Reason <span className="font-normal text-[#50586c]">(optional)</span>
                          </span>
                          <Input name="note" maxLength={300} />
                        </label>
                        <Button type="submit" variant="outline">
                          Reschedule
                        </Button>
                      </form>

                      <form action={changeFittingStatusAction} className="space-y-3">
                        <input type="hidden" name="orderId" value={id} />
                        <input type="hidden" name="sessionId" value={fitting.id} />
                        <input type="hidden" name="version" value={fitting.version} />
                        <h3 className="text-sm font-semibold text-[#272c45]">Change status</h3>
                        <label className="form-group">
                          <span className="text-xs">New status</span>
                          <NativeSelect name="newStatus" defaultValue="completed">
                            {FITTING_SESSION_STATUSES.filter((status) => status !== fitting.status).map((status) => (
                              <option key={status} value={status}>
                                {FITTING_STATUS_LABELS[status]}
                              </option>
                            ))}
                          </NativeSelect>
                        </label>
                        <label className="form-group">
                          <span className="text-xs">
                            Note <span className="font-normal text-[#50586c]">(optional)</span>
                          </span>
                          <Input name="note" maxLength={300} />
                        </label>
                        <Button type="submit" variant="outline">
                          Save status
                        </Button>
                      </form>
                    </div>
                  ) : null}

                  <form action={updateFittingSummaryAction} className="mt-6 space-y-3">
                    <input type="hidden" name="orderId" value={id} />
                    <input type="hidden" name="sessionId" value={fitting.id} />
                    <input type="hidden" name="version" value={fitting.version} />
                    <label className="form-group">
                      <span>
                        Client-facing summary{" "}
                        <span className="font-normal text-[#50586c]">— the only text the client sees</span>
                      </span>
                      <textarea name="clientSummary" defaultValue={fitting.clientSummary} className={textareaClass} />
                    </label>
                    <Button type="submit" variant="outline">
                      Save summary
                    </Button>
                  </form>

                  <div className="mt-6">
                    <h3 className="text-sm font-semibold text-[#272c45]">Internal notes</h3>
                    <p className="mt-1 text-xs text-[#767b89]">
                      Alterations and anything else the team should know. Never shown to the client.
                    </p>
                    {notes.length ? (
                      <ol className="mt-3 divide-y divide-[#eceae2] border-y border-[#eceae2]">
                        {notes.map((note) => (
                          <li key={note.id} className="py-3">
                            <p className="text-sm leading-6 text-[#272c45]">{note.note}</p>
                            <p className="mt-1 text-xs text-[#767b89]">
                              {note.createdByName} · {note.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                            </p>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="mt-3 text-sm text-[#767b89]">No notes yet.</p>
                    )}
                    <form action={addFittingNoteAction} className="mt-3 flex flex-wrap items-end gap-2">
                      <input type="hidden" name="orderId" value={id} />
                      <input type="hidden" name="sessionId" value={fitting.id} />
                      <label className="form-group flex-1">
                        <span className="text-xs">Add a note</span>
                        <Input name="note" required maxLength={300} />
                      </label>
                      <Button type="submit" variant="outline">
                        Add note
                      </Button>
                    </form>
                  </div>

                  <div className="mt-6">
                    <h3 className="text-sm font-semibold text-[#272c45]">Client confirmation</h3>
                    {confirmations.length ? (
                      <div className="mt-2 divide-y divide-[#eceae2]">
                        {confirmations.map((confirmation) => (
                          <p key={confirmation.id} className="py-2 text-sm text-[#171b36]">
                            {confirmation.status}
                            {confirmation.decisionComment ? ` — "${confirmation.decisionComment}"` : ""}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-[#767b89]">Not sent yet.</p>
                    )}
                    {fitting.status === "completed" && !fitting.archivedAt ? (
                      <form action={issueFittingConfirmationAction} className="mt-3">
                        <input type="hidden" name="orderId" value={id} />
                        <input type="hidden" name="sessionId" value={fitting.id} />
                        <Button type="submit" variant="outline">
                          Send confirmation link
                        </Button>
                      </form>
                    ) : null}
                  </div>

                  {history.length ? (
                    <details className="mt-6">
                      <summary className="cursor-pointer text-sm font-semibold text-[#50586c]">History</summary>
                      <ol className="mt-3 divide-y divide-[#eceae2] border-y border-[#eceae2]">
                        {history.map((entry) => (
                          <li key={entry.id} className="py-3 text-sm">
                            <p className="text-[#171b36]">
                              {entry.previousStatus === null
                                ? `Scheduled for ${dateTimeFormatter.format(entry.newScheduledAt)}`
                                : entry.previousStatus !== entry.newStatus
                                  ? `${FITTING_STATUS_LABELS[entry.previousStatus]} → ${FITTING_STATUS_LABELS[entry.newStatus]}`
                                  : `Moved from ${entry.previousScheduledAt ? dateTimeFormatter.format(entry.previousScheduledAt) : "—"} to ${dateTimeFormatter.format(entry.newScheduledAt)}`}
                            </p>
                            <p className="mt-1 text-xs text-[#767b89]">
                              {entry.changedByName} · {entry.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                            </p>
                            {entry.note ? <p className="mt-1 text-sm text-[#50586c]">{entry.note}</p> : null}
                          </li>
                        ))}
                      </ol>
                    </details>
                  ) : null}

                  {!fitting.archivedAt && mayArchive("fitting_session", session.role) ? (
                    <form action={archiveFittingAction} className="mt-4">
                      <input type="hidden" name="orderId" value={id} />
                      <input type="hidden" name="sessionId" value={fitting.id} />
                      <input type="hidden" name="version" value={fitting.version} />
                      <Button type="submit" variant="outline">
                        Archive Fitting
                      </Button>
                    </form>
                  ) : null}
                  {fitting.archivedAt && mayRestore("fitting_session", session.role) ? (
                    <form action={restoreFittingAction} className="mt-4">
                      <input type="hidden" name="orderId" value={id} />
                      <input type="hidden" name="sessionId" value={fitting.id} />
                      <input type="hidden" name="version" value={fitting.version} />
                      <Button type="submit" variant="outline">
                        Restore Fitting
                      </Button>
                    </form>
                  ) : null}
                </div>
              );
            })
          ) : (
            <EmptyState
              title="No Fittings yet"
              description="Schedule the first fitting once there is something to try on."
            />
          )}
        </div>

        <aside>
          <h2 className="section-title">Schedule a Fitting</h2>
          <form action={scheduleFittingAction} className="mt-4 space-y-4 border-t border-[#d9d8d1] pt-5">
            <input type="hidden" name="orderId" value={id} />
            <label className="form-group">
              <span>Date and time</span>
              <Input type="datetime-local" name="scheduledAt" required />
            </label>
            <label className="form-group">
              <span>
                Look <span className="font-normal text-[#50586c]">(optional)</span>
              </span>
              <NativeSelect name="lookId" defaultValue="">
                <option value="">Whole Order</option>
                {liveLooks.map((look) => (
                  <option key={look.id} value={look.id}>
                    {look.name}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="form-group">
              <span>
                Location <span className="font-normal text-[#50586c]">(optional)</span>
              </span>
              <Input name="location" maxLength={160} />
            </label>
            <Button className="w-full" type="submit">
              Schedule Fitting
            </Button>
          </form>
          <p className="mt-3 text-xs leading-5 text-[#767b89]">
            A repeat fitting is simply another session — schedule as many as the Order needs.
          </p>
        </aside>
      </section>
    </div>
  );
}
