import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { archiveEnquiryAction, restoreEnquiryAction } from "@/app/actions/enquiries";
import { Button } from "@/components/ui/button";
import { DuplicateWarning } from "@/components/enquiries/duplicate-warning";
import { FollowUpNotesSection, TasksSection } from "@/components/enquiries/enquiry-follow-up-sections";
import { requireStaffSession } from "@/lib/auth/session";
import { mayArchive, mayRestore } from "@/lib/domain/record-lifecycle";
import {
  getConvertedRecordReferences,
  getDuplicateMatchesForEnquiry,
  getEnquiry,
  listFollowUpNotes,
  listTasks,
} from "@/lib/enquiries/repository";
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

  const [notes, tasks, staff, convertedReferences, duplicateMatches] = await Promise.all([
    listFollowUpNotes(id),
    listTasks(id),
    listStaffMembers(session.organizationId),
    enquiry.convertedClientId && enquiry.convertedOrderId
      ? getConvertedRecordReferences(session.organizationId, enquiry.convertedClientId, enquiry.convertedOrderId)
      : Promise.resolve(null),
    enquiry.convertedAt || enquiry.archivedAt
      ? Promise.resolve([])
      : getDuplicateMatchesForEnquiry(session.organizationId, enquiry.id),
  ]);

  const owner = staff.find((member) => member.userId === enquiry.ownerStaffId);
  const isArchived = Boolean(enquiry.archivedAt);
  const isConverted = Boolean(enquiry.convertedAt);
  const canEditEnquiry = !isConverted && !isArchived;

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
          {enquiry.channel === "external_form" ? "Submitted via intake link" : "Created by staff"} -{" "}
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
          ) : (
            "Converted into a Client and Active Order."
          )}
        </p>
      ) : null}
      {isArchived ? <p className="form-alert mt-6">This Enquiry is archived.</p> : null}
      {canEditEnquiry ? <DuplicateWarning matches={duplicateMatches} /> : null}

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
                <dd className="mt-1 text-sm text-kuartz-ink">{enquiry.email || "-"}</dd>
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
                <dd className="mt-1 text-sm text-kuartz-ink">{enquiry.budgetRange || "-"}</dd>
              </div>
              {enquiry.channel === "internal_staff" ? (
                <>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-kuartz-secondary">Lead source</dt>
                    <dd className="mt-1 text-sm text-kuartz-ink">{enquiry.leadSource || "-"}</dd>
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

          <FollowUpNotesSection
            enquiryId={enquiry.id}
            canAdd={canEditEnquiry}
            notes={notes.map((note) => ({
              id: note.id,
              note: note.note,
              createdByName: note.createdByName,
              createdAtLabel: dateFormatter.format(note.createdAt),
              nextFollowUpDateLabel: note.nextFollowUpDate ? dayFormatter.format(new Date(note.nextFollowUpDate)) : null,
            }))}
          />

          <TasksSection
            enquiryId={enquiry.id}
            canAdd={canEditEnquiry}
            currentUserId={session.userId}
            staff={staff}
            tasks={tasks.map((task) => ({
              id: task.id,
              title: task.title,
              dueDateLabel: dayFormatter.format(new Date(task.dueDate)),
              status: task.status,
              version: task.version,
              assignedToName: task.assignedToName,
            }))}
          />
        </div>

        <aside className="space-y-4">
          {canEditEnquiry ? (
            <>
              <Link
                href={`/enquiries/${enquiry.id}/convert`}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-[0.9rem] border border-kuartz-lime bg-kuartz-lime px-4 text-sm font-extrabold text-kuartz-ink shadow-[0_14px_34px_rgba(166,211,64,0.22)] transition-[transform,background,color,border-color,box-shadow] duration-150 hover:-translate-y-px hover:bg-kuartz-limeDeep focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-kuartz-lime/30 active:scale-[0.98]"
              >
                Convert to Client + Order
              </Link>
              <Link
                href={`/enquiries/${enquiry.id}/edit`}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-[0.9rem] border border-kuartz-control bg-white/85 px-4 text-sm font-extrabold text-kuartz-ink shadow-sm transition-[transform,background,color,border-color,box-shadow] duration-150 hover:-translate-y-px hover:border-kuartz-ink hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-kuartz-lime/30 active:scale-[0.98]"
              >
                Edit Enquiry
              </Link>
            </>
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
