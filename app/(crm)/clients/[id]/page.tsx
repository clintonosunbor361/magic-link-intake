import Link from "next/link";
import { notFound } from "next/navigation";
import { archiveClientAction, restoreClientAction, updateClientAction } from "@/app/actions/clients";
import {
  archiveMeasurementProfileAction,
  archiveMeasurementProfileAttachmentAction,
  restoreMeasurementProfileAction,
  restoreMeasurementProfileAttachmentAction,
  uploadMeasurementProfileAttachmentAction,
} from "@/app/actions/measurement-profiles";
import { issueMeasurementConfirmationAction } from "@/app/actions/client-confirmations";
import { requireStaffSession } from "@/lib/auth/session";
import { canManageMeasurementFieldDefinitions } from "@/lib/domain/access-control";
import { mayArchive, mayRestore } from "@/lib/domain/record-lifecycle";
import { getClient, listOrdersForClient } from "@/lib/clients/repository";
import {
  createMeasurementProfileRepository,
  listMeasurementProfileAttachments,
  listMeasurementProfileSnapshot,
} from "@/lib/measurement-profiles/repository";
import { getOrCreateMeasurementProfile } from "@/lib/measurement-profiles/service";
import { listConfirmationsForSubject } from "@/lib/client-confirmations/repository";
import { getSignedPrivateViewUrl } from "@/lib/storage/r2";
import { formatMinorUnits } from "@/lib/forms/money";
import { listClientTasks } from "@/lib/client-todos/repository";
import { listStaffMembers } from "@/lib/team/repository";
import { ClientTodosSection } from "@/components/clients/client-todos-section";
import { MeasurementDrawer } from "@/components/clients/measurement-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const dateFormatter = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" });

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireStaffSession();
  const { id } = await params;
  const { error } = await searchParams;

  const client = await getClient(session.organizationId, id);
  if (!client) notFound();

  const [orders, clientTasks, staff] = await Promise.all([
    listOrdersForClient(session.organizationId, id),
    listClientTasks(session.organizationId, id),
    listStaffMembers(session.organizationId),
  ]);

  const measurementProfile = await getOrCreateMeasurementProfile(
    { organizationId: session.organizationId, clientId: id },
    createMeasurementProfileRepository(),
  );
  const [measurementFields, attachments, measurementConfirmations] = await Promise.all([
    listMeasurementProfileSnapshot(session.organizationId, measurementProfile.id),
    listMeasurementProfileAttachments(session.organizationId, measurementProfile.id),
    listConfirmationsForSubject(session.organizationId, "measurement_profile", measurementProfile.id),
  ]);
  const attachmentSignedUrlEntries = await Promise.all(
    attachments.map(async (attachment) => [attachment.id, await getSignedPrivateViewUrl(attachment.r2ObjectKey)] as const),
  );
  const attachmentSignedUrlById = new Map(attachmentSignedUrlEntries);

  const isArchived = Boolean(client.archivedAt);

  return (
    <div>
      <nav aria-label="Breadcrumb" className="mb-4 text-sm"><Link href="/clients" className="font-semibold text-kuartz-secondary hover:text-kuartz-ink hover:underline">Clients</Link><span className="mx-2 text-kuartz-muted">/</span><span aria-current="page" className="text-kuartz-muted">{client.fullName}</span></nav>
      <header className="border-b border-kuartz-line pb-8">
        <p className="eyebrow">Client</p>
        <h1 className="page-title">{client.fullName}</h1>
        <p className="page-description">Client since {dateFormatter.format(client.createdAt)}</p>
        {!isArchived ? <div className="mt-5 flex flex-wrap gap-3"><Button asChild><Link href={`/clients/${client.id}/orders/new`}>New Order</Link></Button></div> : null}
      </header>

      {error ? (
        <p className="form-alert mt-6" role="alert">
          {error}
        </p>
      ) : null}
      {isArchived ? <p className="form-alert mt-6">This Client is archived.</p> : null}

      <section className="mt-9 grid gap-10 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-8">
          <div>
            <h2 className="section-title">Identity</h2>
            <form action={updateClientAction} className="mt-4 space-y-4 border-y border-kuartz-line py-5">
              <input type="hidden" name="clientId" value={client.id} />
              <input type="hidden" name="version" value={client.version} />
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="form-group">
                  <span>Full name</span>
                  <Input name="fullName" defaultValue={client.fullName} required />
                </label>
                <label className="form-group">
                  <span>Primary phone</span>
                  <Input name="primaryPhone" defaultValue={client.primaryPhone} required />
                </label>
                <label className="form-group">
                  <span>
                    WhatsApp <span className="font-normal text-kuartz-secondary">(optional)</span>
                  </span>
                  <Input name="whatsappPhone" defaultValue={client.whatsappPhone ?? ""} />
                </label>
                <label className="form-group">
                  <span>
                    Email <span className="font-normal text-kuartz-secondary">(optional)</span>
                  </span>
                  <Input name="email" type="email" defaultValue={client.email ?? ""} />
                </label>
              </div>
              <Button type="submit" variant="outline">
                Save identity
              </Button>
            </form>
          </div>

          <div>
            <h2 className="section-title">Contact context</h2>
            <div className="mt-4 grid gap-4 border-y border-kuartz-line py-5 text-sm sm:grid-cols-2">
              <p><span className="font-semibold text-kuartz-ink">Event type:</span> <span className="text-kuartz-secondary">{client.eventType ?? "Not set"}</span></p>
              <p><span className="font-semibold text-kuartz-ink">Budget range:</span> <span className="text-kuartz-secondary">{client.budgetRange ?? "Not set"}</span></p>
              <p><span className="font-semibold text-kuartz-ink">Contact channel:</span> <span className="text-kuartz-secondary">{client.preferredContactChannel ?? "Not set"}</span></p>
              <p><span className="font-semibold text-kuartz-ink">Lead source:</span> <span className="text-kuartz-secondary">{client.leadSource ?? "Not set"}</span></p>
              <p className="sm:col-span-2"><span className="font-semibold text-kuartz-ink">Brief:</span> <span className="text-kuartz-secondary">{client.brief || "No brief yet"}</span></p>
              <p className="sm:col-span-2"><span className="font-semibold text-kuartz-ink">Internal notes:</span> <span className="text-kuartz-secondary">{client.internalNotes || "No internal notes yet"}</span></p>
            </div>
          </div>

          <ClientTodosSection clientId={client.id} tasks={clientTasks} staff={staff} currentUserId={session.userId} />

          <div>
            <h2 className="section-title">Order history</h2>
            <div className="mt-4 divide-y divide-kuartz-line border-y border-kuartz-line">
              {orders.length ? (
                orders.map((order) => (
                  <div
                    key={order.id}
                    className="grid gap-1 py-4 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                  >
                    <div>
                      <Link href={`/orders/${order.id}`} className="font-semibold text-kuartz-ink hover:underline">
                        {order.title}
                      </Link>
                      <p className="mt-1 text-kuartz-secondary">
                        {order.eventType} - {dateFormatter.format(order.createdAt)}
                        {order.archivedAt ? " - Archived" : ""}
                      </p>
                    </div>
                    <p className="text-kuartz-ink">NGN {formatMinorUnits(order.finalAgreedPriceMinor)}</p>
                  </div>
                ))
              ) : (
                <p className="py-8 text-sm text-kuartz-muted">No Orders yet for this Client.</p>
              )}
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="section-title">Measurements</h2>
              <MeasurementDrawer
                clientId={client.id}
                measurementProfileId={measurementProfile.id}
                fields={measurementFields}
                canAddCustomFields={canManageMeasurementFieldDefinitions(session.role)}
                disabled={Boolean(measurementProfile.archivedAt)}
              />
            </div>
            {measurementProfile.archivedAt ? <p className="mt-2 text-sm text-kuartz-muted">This measurement profile is archived.</p> : null}
            <div className="mt-4 divide-y divide-kuartz-line border-y border-kuartz-line">
              {measurementFields.map((field) => (
                <div key={field.fieldId} className="py-4">
                  <div className="grid gap-3 text-sm sm:grid-cols-[minmax(12rem,0.38fr)_minmax(0,1fr)]">
                    <div>
                      <p className="font-semibold text-kuartz-ink">{field.fieldName}</p>
                      <p className="mt-1 text-xs text-kuartz-muted">{field.unit}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-kuartz-ink">{field.value ? `${field.value} ${field.unit}` : "Not recorded yet"}</p>
                      {field.value ? (
                        <p className="mt-1 text-xs text-kuartz-muted">
                          {field.lastEditedByName ? `Last edited by ${field.lastEditedByName}` : `Set by ${field.createdByName}`}
                          {field.lastEditedAt ? ` Ã‚Â· ${dateFormatter.format(field.lastEditedAt)}` : ""}
                        </p>
                      ) : null}
                      {field.revisions.length ? (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs font-semibold text-kuartz-secondary">
                            Edit history ({field.revisions.length})
                          </summary>
                          <ul className="mt-2 space-y-1 text-sm text-kuartz-muted">
                            {field.revisions.map((revision) => (
                              <li key={revision.id}>
                                {revision.previousValue ?? "(unset)"} {"->"} {revision.newValue} - {revision.changedByName} -{" "}
                                {dateFormatter.format(revision.createdAt)}
                                {revision.note ? ` - "${revision.note}"` : ""}
                              </li>
                            ))}
                          </ul>
                        </details>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-kuartz-secondary">Attachments</h3>
              <div className="mt-3 space-y-2">
                {attachments.length ? (
                  attachments.map((attachment) => {
                    const signedUrl = attachmentSignedUrlById.get(attachment.id);
                    return (
                      <div key={attachment.id} className="flex items-center justify-between gap-3 text-sm">
                        {signedUrl ? (
                          <a href={signedUrl} target="_blank" rel="noreferrer" className="underline">
                            {attachment.archivedAt ? "Archived attachment" : "View attachment"}
                          </a>
                        ) : null}
                        {!attachment.archivedAt && mayArchive("measurement_profile_attachment", session.role) ? (
                          <form action={archiveMeasurementProfileAttachmentAction}>
                            <input type="hidden" name="clientId" value={client.id} />
                            <input type="hidden" name="attachmentId" value={attachment.id} />
                            <input type="hidden" name="version" value={attachment.version} />
                            <Button type="submit" variant="ghost">
                              Archive
                            </Button>
                          </form>
                        ) : null}
                        {attachment.archivedAt && mayRestore("measurement_profile_attachment", session.role) ? (
                          <form action={restoreMeasurementProfileAttachmentAction}>
                            <input type="hidden" name="clientId" value={client.id} />
                            <input type="hidden" name="attachmentId" value={attachment.id} />
                            <input type="hidden" name="version" value={attachment.version} />
                            <Button type="submit" variant="ghost">
                              Restore
                            </Button>
                          </form>
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-kuartz-muted">No attachments yet.</p>
                )}
              </div>
              <form
                action={uploadMeasurementProfileAttachmentAction}
                className="mt-4 flex flex-wrap items-end gap-3"
              >
                <input type="hidden" name="clientId" value={client.id} />
                <input type="hidden" name="measurementProfileId" value={measurementProfile.id} />
                <label className="form-group">
                  <span>Upload sheet/photo</span>
                  <input type="file" name="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" required />
                </label>
                <Button type="submit" variant="outline">
                  Upload
                </Button>
              </form>
            </div>

            <div className="mt-4">
              {!measurementProfile.archivedAt && mayArchive("measurement_profile", session.role) ? (
                <form action={archiveMeasurementProfileAction}>
                  <input type="hidden" name="clientId" value={client.id} />
                  <input type="hidden" name="measurementProfileId" value={measurementProfile.id} />
                  <input type="hidden" name="version" value={measurementProfile.version} />
                  <Button type="submit" variant="ghost">
                    Archive measurement profile
                  </Button>
                </form>
              ) : null}
              {measurementProfile.archivedAt && mayRestore("measurement_profile", session.role) ? (
                <form action={restoreMeasurementProfileAction}>
                  <input type="hidden" name="clientId" value={client.id} />
                  <input type="hidden" name="measurementProfileId" value={measurementProfile.id} />
                  <input type="hidden" name="version" value={measurementProfile.version} />
                  <Button type="submit" variant="ghost">
                    Restore measurement profile
                  </Button>
                </form>
              ) : null}
            </div>

            <div className="mt-6">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-kuartz-secondary">Measurement confirmations</h3>
              <div className="mt-3 divide-y divide-kuartz-lineSoft">
                {measurementConfirmations.length ? (
                  measurementConfirmations.map((confirmation) => (
                    <div key={confirmation.id} className="grid gap-1 py-3 text-sm sm:grid-cols-[1fr_auto]">
                      <p className="text-kuartz-ink">
                        Created {dateFormatter.format(confirmation.createdAt)}
                        {confirmation.deliveryMethod ? ` Ãƒâ€šÃ‚Â· ${confirmation.deliveryMethod === "email" ? "Emailed" : "Copied"}` : " Ãƒâ€šÃ‚Â· Not yet delivered"}
                        {confirmation.decisionComment ? ` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â "${confirmation.decisionComment}"` : ""}
                      </p>
                      <p className="font-semibold text-kuartz-muted">{confirmation.status}</p>
                    </div>
                  ))
                ) : (
                  <p className="py-3 text-sm text-kuartz-muted">No measurement confirmations sent yet.</p>
                )}
              </div>
              <form action={issueMeasurementConfirmationAction} className="mt-4">
                <input type="hidden" name="clientId" value={client.id} />
                <input type="hidden" name="measurementProfileId" value={measurementProfile.id} />
                <Button type="submit" variant="outline">
                  Send measurement confirmation
                </Button>
              </form>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          {!isArchived && mayArchive("client", session.role) ? (
            <form action={archiveClientAction}>
              <input type="hidden" name="clientId" value={client.id} />
              <input type="hidden" name="version" value={client.version} />
              <Button type="submit" variant="outline" className="w-full">
                Archive Client
              </Button>
            </form>
          ) : null}

          {isArchived && mayRestore("client", session.role) ? (
            <form action={restoreClientAction}>
              <input type="hidden" name="clientId" value={client.id} />
              <input type="hidden" name="version" value={client.version} />
              <Button type="submit" variant="outline" className="w-full">
                Restore Client
              </Button>
            </form>
          ) : null}
        </aside>
      </section>
    </div>
  );
}
