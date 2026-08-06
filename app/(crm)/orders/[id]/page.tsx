import Link from "next/link";
import { notFound } from "next/navigation";
import {
  archiveItemAction,
  archiveLookAction,
  archiveOrderAction,
  createItemAction,
  createLookAction,
  restoreItemAction,
  restoreLookAction,
  restoreOrderAction,
  updateItemAction,
  updateLookAction,
  updateOrderAction,
} from "@/app/actions/orders";
import {
  archiveConsultationNoteAction,
  createConsultationNoteAction,
  restoreConsultationNoteAction,
  updateConsultationNoteAction,
} from "@/app/actions/consultation-notes";
import {
  archiveStyleDirectionFileAction,
  restoreStyleDirectionFileAction,
  reviseStyleDirectionFileAction,
  uploadStyleDirectionFileAction,
} from "@/app/actions/style-direction-files";
import { requireStaffSession } from "@/lib/auth/session";
import { mayArchive, mayRestore } from "@/lib/domain/record-lifecycle";
import { getOrderWithLooksAndItems } from "@/lib/orders/repository";
import { listItemTypes } from "@/lib/item-types/repository";
import { listConsultationNoteSources } from "@/lib/consultation-note-sources/repository";
import { listConsultationNotesForOrder } from "@/lib/consultation-notes/repository";
import {
  listStyleDirectionFileRevisionsForFiles,
  listStyleDirectionFilesForOrder,
} from "@/lib/style-direction-files/repository";
import { formatStyleDirectionLabel, STYLE_DIRECTION_FILE_CATEGORIES } from "@/lib/style-direction-files/file-service";
import { getSignedStyleDirectionViewUrl } from "@/lib/storage/r2";
import {
  listApprovalBatchesForOrder,
  listPendingApprovalFiles,
  listRevisionQueueFiles,
} from "@/lib/style-direction-approvals/repository";
import { formatMinorUnits } from "@/lib/forms/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

const dateFormatter = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" });

// See app/actions/consultation-notes.ts's readOccurredAt for why this round-trips as UTC digits.
function toDateTimeLocalValue(date: Date | null): string {
  return date ? date.toISOString().slice(0, 16) : "";
}

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireStaffSession();
  const { id } = await params;
  const { error } = await searchParams;

  const order = await getOrderWithLooksAndItems(session.organizationId, id);
  if (!order) notFound();

  const itemTypes = await listItemTypes(session.organizationId);
  const [consultationNoteSources, consultationNotes, styleDirectionFiles, approvalBatches, pendingApprovalFiles, revisionQueueFiles] =
    await Promise.all([
      listConsultationNoteSources(session.organizationId),
      listConsultationNotesForOrder(session.organizationId, order.id),
      listStyleDirectionFilesForOrder(session.organizationId, order.id),
      listApprovalBatchesForOrder(session.organizationId, order.id),
      listPendingApprovalFiles(session.organizationId, order.id),
      listRevisionQueueFiles(session.organizationId, order.id),
    ]);
  const styleDirectionRevisions = await listStyleDirectionFileRevisionsForFiles(
    session.organizationId,
    styleDirectionFiles.map((file) => file.id),
  );
  const revisionKeys = [
    ...styleDirectionFiles.map((file) => file.currentRevisionKey).filter((key): key is string => Boolean(key)),
    ...styleDirectionRevisions.map((revision) => revision.r2ObjectKey),
  ];
  const signedUrlEntries = await Promise.all(
    [...new Set(revisionKeys)].map(async (key) => [key, await getSignedStyleDirectionViewUrl(key)] as const),
  );
  const signedUrlByKey = new Map(signedUrlEntries);
  const isArchived = Boolean(order.archivedAt);

  return (
    <div>
      <header className="border-b border-[#d9d8d1] pb-8">
        <p className="eyebrow">Order</p>
        <h1 className="page-title">{order.title}</h1>
        <p className="page-description">
          <Link href={`/clients/${order.clientId}`} className="hover:underline">
            {order.clientFullName}
          </Link>{" "}
          · {dateFormatter.format(order.createdAt)}
        </p>
      </header>

      {error ? (
        <p className="form-alert mt-6" role="alert">
          {error}
        </p>
      ) : null}
      {isArchived ? <p className="form-alert mt-6">This Order is archived.</p> : null}

      <section className="mt-9 grid gap-10 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-8">
          <div>
            <h2 className="section-title">Order details</h2>
            <form action={updateOrderAction} className="mt-4 space-y-4 border-y border-[#d9d8d1] py-5">
              <input type="hidden" name="orderId" value={order.id} />
              <input type="hidden" name="version" value={order.version} />
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="form-group">
                  <span>Title</span>
                  <Input name="title" defaultValue={order.title} required />
                </label>
                <label className="form-group">
                  <span>Event type</span>
                  <Input name="eventType" defaultValue={order.eventType} required />
                </label>
                <label className="form-group">
                  <span>Final agreed price (₦)</span>
                  <Input name="finalAgreedPrice" defaultValue={formatMinorUnits(order.finalAgreedPriceMinor)} required />
                </label>
                <label className="form-group">
                  <span>
                    FF discount amount (₦) <span className="font-normal text-[#50586c]">(optional)</span>
                  </span>
                  <Input
                    name="ffDiscountAmount"
                    defaultValue={order.ffDiscountAmountMinor != null ? formatMinorUnits(order.ffDiscountAmountMinor) : ""}
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold text-[#50586c]">
                <input type="checkbox" name="ffDiscount" defaultChecked={order.ffDiscount} />
                Family &amp; friends discount applied
              </label>
              <Button type="submit" variant="outline">
                Save Order details
              </Button>
            </form>
          </div>

          <div>
            <h2 className="section-title">Looks</h2>
            <div className="mt-4 space-y-6">
              {order.looks.map((look) => (
                <div key={look.id} role="group" aria-label={look.name} className="border-y border-[#d9d8d1] py-5">
                  <div className="flex items-start justify-between gap-4">
                    <p className="font-semibold text-[#171b36]">
                      {look.name}
                      {look.archivedAt ? <span className="ml-2 text-xs font-normal text-[#767b89]">Archived</span> : null}
                    </p>
                    {!look.archivedAt && mayArchive("look", session.role) ? (
                      <form action={archiveLookAction}>
                        <input type="hidden" name="orderId" value={order.id} />
                        <input type="hidden" name="lookId" value={look.id} />
                        <input type="hidden" name="version" value={look.version} />
                        <Button type="submit" variant="outline">
                          Archive Look
                        </Button>
                      </form>
                    ) : null}
                    {look.archivedAt && mayRestore("look", session.role) ? (
                      <form action={restoreLookAction}>
                        <input type="hidden" name="orderId" value={order.id} />
                        <input type="hidden" name="lookId" value={look.id} />
                        <input type="hidden" name="version" value={look.version} />
                        <Button type="submit" variant="outline">
                          Restore Look
                        </Button>
                      </form>
                    ) : null}
                  </div>

                  <form action={updateLookAction} className="mt-4 space-y-3">
                    <input type="hidden" name="orderId" value={order.id} />
                    <input type="hidden" name="lookId" value={look.id} />
                    <input type="hidden" name="version" value={look.version} />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="form-group">
                        <span>Name</span>
                        <Input name="name" defaultValue={look.name} required />
                      </label>
                      <label className="form-group">
                        <span>
                          Look date <span className="font-normal text-[#50586c]">(optional)</span>
                        </span>
                        <Input type="date" name="lookDate" defaultValue={look.lookDate ?? ""} />
                      </label>
                    </div>
                    <label className="form-group">
                      <span>
                        Notes <span className="font-normal text-[#50586c]">(optional)</span>
                      </span>
                      <textarea
                        name="notes"
                        defaultValue={look.notes}
                        className="min-h-[3.5rem] w-full rounded-[0.8rem] border border-[#cfcec7] bg-white/70 px-3.5 py-3 text-sm text-[#171b36] outline-none focus:border-[#88925f] focus:bg-white focus:ring-4 focus:ring-[#d2ff67]/20"
                      />
                    </label>
                    <Button type="submit" variant="outline">
                      Save Look
                    </Button>
                  </form>

                  <div className="mt-5">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-[#50586c]">Items</h3>
                    <div className="mt-3 divide-y divide-[#eceae2]">
                      {look.items.length ? (
                        look.items.map((item) => (
                          <div key={item.id} className="py-3">
                            <form action={updateItemAction} className="flex flex-wrap items-end gap-3">
                              <input type="hidden" name="orderId" value={order.id} />
                              <input type="hidden" name="itemId" value={item.id} />
                              <input type="hidden" name="version" value={item.version} />
                              <label className="form-group">
                                <span>Type</span>
                                <NativeSelect name="itemTypeId" defaultValue={item.itemTypeId}>
                                  {itemTypes.map((itemType) => (
                                    <option key={itemType.id} value={itemType.id}>
                                      {itemType.name}
                                    </option>
                                  ))}
                                </NativeSelect>
                              </label>
                              <label className="form-group">
                                <span>
                                  Custom label <span className="font-normal text-[#50586c]">(optional)</span>
                                </span>
                                <Input name="customLabel" defaultValue={item.customLabel ?? ""} />
                              </label>
                              <label className="form-group w-24">
                                <span>Qty</span>
                                <Input type="number" min={1} name="quantity" defaultValue={item.quantity} required />
                              </label>
                              <Button type="submit" variant="outline">
                                Save
                              </Button>
                              {item.archivedAt ? <span className="text-xs font-semibold text-[#767b89]">Archived</span> : null}
                            </form>
                            <div className="mt-2">
                              {!item.archivedAt && mayArchive("item", session.role) ? (
                                <form action={archiveItemAction}>
                                  <input type="hidden" name="orderId" value={order.id} />
                                  <input type="hidden" name="itemId" value={item.id} />
                                  <input type="hidden" name="version" value={item.version} />
                                  <Button type="submit" variant="ghost">
                                    Archive item
                                  </Button>
                                </form>
                              ) : null}
                              {item.archivedAt && mayRestore("item", session.role) ? (
                                <form action={restoreItemAction}>
                                  <input type="hidden" name="orderId" value={order.id} />
                                  <input type="hidden" name="itemId" value={item.id} />
                                  <input type="hidden" name="version" value={item.version} />
                                  <Button type="submit" variant="ghost">
                                    Restore item
                                  </Button>
                                </form>
                              ) : null}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="py-3 text-sm text-[#767b89]">No Items yet on this Look.</p>
                      )}
                    </div>

                    <form
                      action={createItemAction}
                      aria-label={`Add Item — ${look.name}`}
                      className="mt-4 flex flex-wrap items-end gap-3"
                    >
                      <input type="hidden" name="orderId" value={order.id} />
                      <input type="hidden" name="lookId" value={look.id} />
                      <label className="form-group">
                        <span>Type</span>
                        <NativeSelect name="itemTypeId" defaultValue={itemTypes[0]?.id}>
                          {itemTypes.map((itemType) => (
                            <option key={itemType.id} value={itemType.id}>
                              {itemType.name}
                            </option>
                          ))}
                        </NativeSelect>
                      </label>
                      <label className="form-group">
                        <span>
                          Custom label <span className="font-normal text-[#50586c]">(optional)</span>
                        </span>
                        <Input name="customLabel" placeholder="Only needed for “Other”" />
                      </label>
                      <label className="form-group w-24">
                        <span>Qty</span>
                        <Input type="number" min={1} name="quantity" defaultValue={1} required />
                      </label>
                      <Button type="submit" variant="outline">
                        Add Item
                      </Button>
                    </form>
                  </div>
                </div>
              ))}
            </div>

            <form action={createLookAction} aria-label="Add a Look" className="mt-6 space-y-3">
              <input type="hidden" name="orderId" value={order.id} />
              <h3 className="section-title">Add a Look</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="form-group">
                  <span>Name</span>
                  <Input name="name" required />
                </label>
                <label className="form-group">
                  <span>
                    Look date <span className="font-normal text-[#50586c]">(optional)</span>
                  </span>
                  <Input type="date" name="lookDate" />
                </label>
              </div>
              <label className="form-group">
                <span>
                  Notes <span className="font-normal text-[#50586c]">(optional)</span>
                </span>
                <textarea
                  name="notes"
                  className="min-h-[3.5rem] w-full rounded-[0.8rem] border border-[#cfcec7] bg-white/70 px-3.5 py-3 text-sm text-[#171b36] outline-none focus:border-[#88925f] focus:bg-white focus:ring-4 focus:ring-[#d2ff67]/20"
                />
              </label>
              <Button type="submit" variant="outline">
                Add Look
              </Button>
            </form>
          </div>

          <div>
            <h2 className="section-title">Consultation Notes</h2>
            <div className="mt-4 space-y-5">
              {consultationNotes.length ? (
                consultationNotes.map((note) => (
                  <div key={note.id} role="group" aria-label={note.sourceName} className="border-y border-[#d9d8d1] py-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#50586c]">
                          {note.sourceName} · {note.lookName ?? "Whole order"}
                        </p>
                        <p className="mt-1 text-sm text-[#767b89]">
                          Created by {note.createdByName}
                          {note.lastEditedByName ? ` · Last edited by ${note.lastEditedByName}` : ""}
                          {note.occurredAt ? ` · Occurred ${dateFormatter.format(note.occurredAt)}` : ""}
                        </p>
                      </div>
                      {note.archivedAt ? <span className="text-xs font-semibold text-[#767b89]">Archived</span> : null}
                    </div>

                    <form action={updateConsultationNoteAction} className="mt-4 space-y-3">
                      <input type="hidden" name="orderId" value={order.id} />
                      <input type="hidden" name="noteId" value={note.id} />
                      <input type="hidden" name="version" value={note.version} />
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="form-group">
                          <span>Source</span>
                          <NativeSelect name="sourceId" defaultValue={note.sourceId}>
                            {consultationNoteSources.map((source) => (
                              <option key={source.id} value={source.id}>
                                {source.name}
                              </option>
                            ))}
                          </NativeSelect>
                        </label>
                        <label className="form-group">
                          <span>
                            Occurred at <span className="font-normal text-[#50586c]">(optional)</span>
                          </span>
                          <Input type="datetime-local" name="occurredAt" defaultValue={toDateTimeLocalValue(note.occurredAt)} />
                        </label>
                      </div>
                      <label className="form-group">
                        <span>Body</span>
                        <textarea
                          name="body"
                          defaultValue={note.body}
                          required
                          className="min-h-[4.5rem] w-full rounded-[0.8rem] border border-[#cfcec7] bg-white/70 px-3.5 py-3 text-sm text-[#171b36] outline-none focus:border-[#88925f] focus:bg-white focus:ring-4 focus:ring-[#d2ff67]/20"
                        />
                      </label>
                      <Button type="submit" variant="outline">
                        Save note
                      </Button>
                    </form>

                    {note.revisions.length ? (
                      <details className="mt-3">
                        <summary className="cursor-pointer text-xs font-semibold text-[#50586c]">
                          Edit history ({note.revisions.length})
                        </summary>
                        <div className="mt-2 space-y-2">
                          {note.revisions.map((revision) => (
                            <div key={revision.id} className="text-sm text-[#767b89]">
                              <p className="font-semibold text-[#171b36]">
                                {revision.sourceName} · {revision.authorName} · {dateFormatter.format(revision.authoredAt)}
                              </p>
                              <p>{revision.body}</p>
                            </div>
                          ))}
                        </div>
                      </details>
                    ) : null}

                    <div className="mt-3">
                      {!note.archivedAt && mayArchive("consultation_note", session.role) ? (
                        <form action={archiveConsultationNoteAction}>
                          <input type="hidden" name="orderId" value={order.id} />
                          <input type="hidden" name="noteId" value={note.id} />
                          <input type="hidden" name="version" value={note.version} />
                          <Button type="submit" variant="ghost">
                            Archive note
                          </Button>
                        </form>
                      ) : null}
                      {note.archivedAt && mayRestore("consultation_note", session.role) ? (
                        <form action={restoreConsultationNoteAction}>
                          <input type="hidden" name="orderId" value={order.id} />
                          <input type="hidden" name="noteId" value={note.id} />
                          <input type="hidden" name="version" value={note.version} />
                          <Button type="submit" variant="ghost">
                            Restore note
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-3 text-sm text-[#767b89]">No Consultation Notes yet.</p>
              )}
            </div>

            <form action={createConsultationNoteAction} aria-label="Add a Consultation Note" className="mt-6 space-y-3">
              <input type="hidden" name="orderId" value={order.id} />
              <h3 className="section-title">Add a Consultation Note</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="form-group">
                  <span>Source</span>
                  <NativeSelect name="sourceId" defaultValue={consultationNoteSources[0]?.id}>
                    {consultationNoteSources.map((source) => (
                      <option key={source.id} value={source.id}>
                        {source.name}
                      </option>
                    ))}
                  </NativeSelect>
                </label>
                <label className="form-group">
                  <span>Scope</span>
                  <NativeSelect name="lookId" defaultValue="">
                    <option value="">Whole order</option>
                    {order.looks.map((look) => (
                      <option key={look.id} value={look.id}>
                        {look.name}
                      </option>
                    ))}
                  </NativeSelect>
                </label>
              </div>
              <label className="form-group">
                <span>
                  Occurred at <span className="font-normal text-[#50586c]">(optional)</span>
                </span>
                <Input type="datetime-local" name="occurredAt" />
              </label>
              <label className="form-group">
                <span>Body</span>
                <textarea
                  name="body"
                  required
                  className="min-h-[4.5rem] w-full rounded-[0.8rem] border border-[#cfcec7] bg-white/70 px-3.5 py-3 text-sm text-[#171b36] outline-none focus:border-[#88925f] focus:bg-white focus:ring-4 focus:ring-[#d2ff67]/20"
                />
              </label>
              <Button type="submit" variant="outline">
                Add Consultation Note
              </Button>
            </form>
          </div>

          <div>
            <h2 className="section-title">Pending client approval</h2>
            <div className="mt-4 divide-y divide-[#eceae2]">
              {pendingApprovalFiles.length ? (
                pendingApprovalFiles.map((file) => (
                  <a key={file.fileId} href={`#file-${file.fileId}`} className="grid gap-1 py-3 text-sm sm:grid-cols-[1fr_auto]">
                    <p className="text-[#171b36] underline">
                      {formatStyleDirectionLabel(file.category)} · {file.lookName ?? "Whole Order"}
                    </p>
                    <p className="font-semibold text-[#767b89]">{file.sentInActiveBatch ? "Sent — awaiting client" : "Awaiting batch"}</p>
                  </a>
                ))
              ) : (
                <p className="py-3 text-sm text-[#767b89]">Nothing is pending client approval.</p>
              )}
            </div>
          </div>

          <div>
            <h2 className="section-title">Needs revision</h2>
            <div className="mt-4 divide-y divide-[#eceae2]">
              {revisionQueueFiles.length ? (
                revisionQueueFiles.map((file) => (
                  <a key={file.fileId} href={`#file-${file.fileId}`} className="grid gap-1 py-3 text-sm">
                    <p className="text-[#171b36] underline">
                      {formatStyleDirectionLabel(file.category)} · {file.lookName ?? "Whole Order"} ·{" "}
                      <span className="font-semibold text-[#767b89]">{formatStyleDirectionLabel(file.approvalStatus)}</span>
                    </p>
                    {file.decisionComment ? <p className="text-[#767b89]">&quot;{file.decisionComment}&quot;</p> : null}
                  </a>
                ))
              ) : (
                <p className="py-3 text-sm text-[#767b89]">No files are waiting on a revision.</p>
              )}
            </div>
          </div>

          <div>
            <h2 className="section-title">Style Direction Files</h2>
            <div className="mt-4 space-y-8">
              {[{ lookId: null, lookName: "Whole Order" }, ...order.looks.map((look) => ({ lookId: look.id, lookName: look.name }))].map(
                (group) => {
                  const groupFiles = styleDirectionFiles.filter((file) => file.lookId === group.lookId);
                  if (!groupFiles.length) return null;
                  return (
                    <div key={group.lookId ?? "whole-order"}>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-[#50586c]">{group.lookName}</h3>
                      <div className="mt-3 space-y-5">
                        {groupFiles.map((file) => {
                          const revisions = styleDirectionRevisions.filter((revision) => revision.styleDirectionFileId === file.id);
                          const currentUrl = file.currentRevisionKey ? signedUrlByKey.get(file.currentRevisionKey) : undefined;
                          return (
                            <div id={`file-${file.id}`} key={file.id} role="group" aria-label={`${formatStyleDirectionLabel(file.category)} — ${group.lookName}`} className="border-y border-[#d9d8d1] py-5">
                              <div className="flex flex-wrap items-start justify-between gap-4">
                                <div>
                                  <p className="font-semibold text-[#171b36]">{formatStyleDirectionLabel(file.category)}</p>
                                  <p className="mt-1 text-sm text-[#767b89]">
                                    {file.requiresClientApproval ? "Requires client approval" : "Internal reference only"}
                                    {file.approvalStatus ? ` · ${formatStyleDirectionLabel(file.approvalStatus)}` : ""}
                                    {file.archivedAt ? " · Archived" : ""}
                                  </p>
                                </div>
                              </div>

                              {currentUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element -- private, signed R2 URL; next/image can't optimize it.
                                <img src={currentUrl} alt={formatStyleDirectionLabel(file.category)} className="mt-3 max-h-64 rounded-[0.8rem] border border-[#d9d8d1] object-contain" />
                              ) : null}

                              <form action={reviseStyleDirectionFileAction} encType="multipart/form-data" className="mt-4 flex flex-wrap items-end gap-3">
                                <input type="hidden" name="orderId" value={order.id} />
                                <input type="hidden" name="fileId" value={file.id} />
                                <input type="hidden" name="version" value={file.version} />
                                <label className="form-group">
                                  <span>Revise</span>
                                  <input type="file" name="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" required />
                                </label>
                                <Button type="submit" variant="outline">
                                  Upload new revision
                                </Button>
                              </form>

                              {revisions.length ? (
                                <details className="mt-3">
                                  <summary className="cursor-pointer text-xs font-semibold text-[#50586c]">
                                    Revision history ({revisions.length})
                                  </summary>
                                  <ul className="mt-2 space-y-1 text-sm text-[#767b89]">
                                    {revisions.map((revision) => {
                                      const revisionUrl = signedUrlByKey.get(revision.r2ObjectKey);
                                      return (
                                        <li key={revision.id}>
                                          Revision {revision.revisionNumber} · {dateFormatter.format(revision.createdAt)}
                                          {revisionUrl ? (
                                            <>
                                              {" "}
                                              ·{" "}
                                              <a href={revisionUrl} target="_blank" rel="noreferrer" className="underline">
                                                View
                                              </a>
                                            </>
                                          ) : null}
                                        </li>
                                      );
                                    })}
                                  </ul>
                                </details>
                              ) : null}

                              <div className="mt-3">
                                {!file.archivedAt && mayArchive("style_direction_file", session.role) ? (
                                  <form action={archiveStyleDirectionFileAction}>
                                    <input type="hidden" name="orderId" value={order.id} />
                                    <input type="hidden" name="fileId" value={file.id} />
                                    <input type="hidden" name="version" value={file.version} />
                                    <Button type="submit" variant="ghost">
                                      Archive file
                                    </Button>
                                  </form>
                                ) : null}
                                {file.archivedAt && mayRestore("style_direction_file", session.role) ? (
                                  <form action={restoreStyleDirectionFileAction}>
                                    <input type="hidden" name="orderId" value={order.id} />
                                    <input type="hidden" name="fileId" value={file.id} />
                                    <input type="hidden" name="version" value={file.version} />
                                    <Button type="submit" variant="ghost">
                                      Restore file
                                    </Button>
                                  </form>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                },
              )}
              {!styleDirectionFiles.length ? <p className="py-3 text-sm text-[#767b89]">No Style Direction Files yet.</p> : null}
            </div>

            <form
              action={uploadStyleDirectionFileAction}
              encType="multipart/form-data"
              aria-label="Add a Style Direction File"
              className="mt-6 space-y-3"
            >
              <input type="hidden" name="orderId" value={order.id} />
              <h3 className="section-title">Add a Style Direction File</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="form-group">
                  <span>Category</span>
                  <NativeSelect name="category" defaultValue={STYLE_DIRECTION_FILE_CATEGORIES[0]}>
                    {STYLE_DIRECTION_FILE_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {formatStyleDirectionLabel(category)}
                      </option>
                    ))}
                  </NativeSelect>
                </label>
                <label className="form-group">
                  <span>Scope</span>
                  <NativeSelect name="lookId" defaultValue="">
                    <option value="">Whole order</option>
                    {order.looks.map((look) => (
                      <option key={look.id} value={look.id}>
                        {look.name}
                      </option>
                    ))}
                  </NativeSelect>
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold text-[#50586c]">
                <input type="checkbox" name="requiresClientApproval" />
                Requires client approval
              </label>
              <label className="form-group">
                <span>File</span>
                <input type="file" name="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" required />
              </label>
              <Button type="submit" variant="outline">
                Add Style Direction File
              </Button>
            </form>
          </div>

          <div>
            <div className="flex items-end justify-between gap-4">
              <h2 className="section-title">Approval batches</h2>
              <Link href={`/orders/${order.id}/approval-batches/new`} className="text-sm font-semibold text-[#171b36] underline">
                Create approval batch
              </Link>
            </div>
            <div className="mt-4 divide-y divide-[#eceae2]">
              {approvalBatches.length ? (
                approvalBatches.map((batch) => (
                  <div key={batch.id} className="grid gap-1 py-3 text-sm sm:grid-cols-[1fr_auto]">
                    <p className="text-[#171b36]">
                      Created {dateFormatter.format(batch.createdAt)}
                      {batch.deliveryMethod ? ` · ${batch.deliveryMethod === "email" ? "Emailed" : "Copied"}` : " · Not yet delivered"}
                    </p>
                    <p className="font-semibold text-[#767b89]">{batch.status}</p>
                  </div>
                ))
              ) : (
                <p className="py-3 text-sm text-[#767b89]">No approval batches yet.</p>
              )}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          {!isArchived && mayArchive("order", session.role) ? (
            <form action={archiveOrderAction}>
              <input type="hidden" name="orderId" value={order.id} />
              <input type="hidden" name="version" value={order.version} />
              <Button type="submit" variant="outline" className="w-full">
                Archive Order
              </Button>
            </form>
          ) : null}

          {isArchived && mayRestore("order", session.role) ? (
            <form action={restoreOrderAction}>
              <input type="hidden" name="orderId" value={order.id} />
              <input type="hidden" name="version" value={order.version} />
              <Button type="submit" variant="outline" className="w-full">
                Restore Order
              </Button>
            </form>
          ) : null}
        </aside>
      </section>
    </div>
  );
}
