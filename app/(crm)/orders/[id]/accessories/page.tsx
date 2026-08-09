import Link from "next/link";
import { notFound } from "next/navigation";
import {
  archiveAccessoryItemAction,
  createAccessoryItemAction,
  restoreAccessoryItemAction,
  updateAccessoryItemAction,
} from "@/app/actions/accessories";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { listAccessoryItemsForOrder } from "@/lib/accessories/repository";
import { listAccessoryStatuses } from "@/lib/accessory-statuses/repository";
import { listAccessoryTypes } from "@/lib/accessory-types/repository";
import { requireStaffSession } from "@/lib/auth/session";
import { mayArchive, mayRestore } from "@/lib/domain/record-lifecycle";
import { getOrderWithLooksAndItems } from "@/lib/orders/repository";

const textareaClass =
  "min-h-[3.5rem] w-full rounded-[0.8rem] border border-[#cfcec7] bg-white/70 px-3.5 py-3 text-sm text-[#171b36] outline-none focus:border-[#88925f] focus:bg-white focus:ring-4 focus:ring-[#d2ff67]/20";

export default async function OrderAccessoriesPage({
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

  const [accessories, types, statuses] = await Promise.all([
    listAccessoryItemsForOrder(session.organizationId, id),
    listAccessoryTypes(session.organizationId),
    listAccessoryStatuses(session.organizationId),
  ]);
  const liveLooks = order.looks.filter((look) => !look.archivedAt);
  const canConfigure = types.length > 0 && statuses.length > 0;

  return (
    <div>
      <Link
        href={`/orders/${id}`}
        className="text-sm font-semibold text-[#50586c] underline-offset-4 transition-colors duration-200 hover:text-[#171b36] hover:underline"
      >
        ← {order.title}
      </Link>

      <header className="mt-4 border-b border-[#d9d8d1] pb-8">
        <p className="eyebrow">Accessory sourcing</p>
        <h1 className="page-title">Accessories</h1>
        <p className="page-description">
          Sourced separately from the garments — Accessories never go to a Vendor Brief and never
          enter Production. Delivery dates are inherited: an Accessory for one Look follows that
          Look&rsquo;s date, and a whole-Order Accessory follows the earliest dated Look.
        </p>
      </header>

      {query.error ? (
        <p className="form-alert mt-6" role="alert">
          {query.error}
        </p>
      ) : null}

      {!canConfigure ? (
        <p className="mt-6 border-l-[3px] border-[#88925f] bg-white/70 px-4 py-3.5 text-sm leading-6 text-[#3f4a24]" role="status">
          A Super Admin needs to configure accessory types and statuses in settings before Accessories
          can be added.
        </p>
      ) : null}

      <section className="mt-9 grid gap-10 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div>
          <h2 className="section-title">Sourced accessories</h2>
          {accessories.length ? (
            <div className="mt-4 space-y-6">
              {accessories.map((accessory) => (
                <div key={accessory.id} className="border-t border-[#d9d8d1] pt-5">
                <form
                  action={updateAccessoryItemAction}
                  aria-label={accessory.label}
                  className="space-y-4"
                >
                  <input type="hidden" name="orderId" value={id} />
                  <input type="hidden" name="accessoryItemId" value={accessory.id} />
                  <input type="hidden" name="version" value={accessory.version} />

                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="section-title">{accessory.label}</h3>
                    <p className="text-sm text-[#767b89]">
                      {accessory.deliveryDate.state === "inherited"
                        ? `Due ${accessory.deliveryDate.date}${accessory.lookName ? ` · ${accessory.lookName}` : " · earliest Look"}`
                        : "No date — no dated Look to inherit from"}
                    </p>
                  </div>

                  {accessory.archivedAt ? <p className="form-alert">This Accessory is archived.</p> : null}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="form-group">
                      <span>Type</span>
                      <NativeSelect name="accessoryTypeId" defaultValue={accessory.accessoryTypeId}>
                        {accessory.typeArchived ? (
                          <option value={accessory.accessoryTypeId}>{accessory.typeName} (archived)</option>
                        ) : null}
                        {types.map((type) => (
                          <option key={type.id} value={type.id}>
                            {type.name}
                          </option>
                        ))}
                      </NativeSelect>
                    </label>
                    <label className="form-group">
                      <span>Status</span>
                      <NativeSelect name="accessoryStatusId" defaultValue={accessory.accessoryStatusId}>
                        {statuses.map((status) => (
                          <option key={status.id} value={status.id}>
                            {status.name}
                          </option>
                        ))}
                      </NativeSelect>
                    </label>
                    <label className="form-group">
                      <span>
                        Label <span className="font-normal text-[#50586c]">(optional)</span>
                      </span>
                      <Input name="customLabel" defaultValue={accessory.customLabel ?? ""} maxLength={120} />
                    </label>
                    <label className="form-group">
                      <span>
                        Look <span className="font-normal text-[#50586c]">(optional)</span>
                      </span>
                      <NativeSelect name="lookId" defaultValue={accessory.lookId ?? ""}>
                        <option value="">Whole Order</option>
                        {liveLooks.map((look) => (
                          <option key={look.id} value={look.id}>
                            {look.name}
                          </option>
                        ))}
                      </NativeSelect>
                    </label>
                  </div>

                  <label className="form-group">
                    <span>
                      Notes <span className="font-normal text-[#50586c]">(optional)</span>
                    </span>
                    <textarea name="notes" defaultValue={accessory.notes} className={textareaClass} />
                  </label>

                  {!accessory.archivedAt ? (
                    <Button type="submit" variant="outline">
                      Save Accessory
                    </Button>
                  ) : null}
                </form>

                {/* Archive and restore are sibling forms, not nested ones — HTML forbids a form
                    inside a form, so these cannot live in the edit form above. */}
                {!accessory.archivedAt && mayArchive("accessory_item", session.role) ? (
                  <form action={archiveAccessoryItemAction} className="mt-3">
                    <input type="hidden" name="orderId" value={id} />
                    <input type="hidden" name="accessoryItemId" value={accessory.id} />
                    <input type="hidden" name="version" value={accessory.version} />
                    <Button type="submit" variant="outline" aria-label={`Cancel ${accessory.label}`}>
                      Cancel Accessory
                    </Button>
                  </form>
                ) : null}
                {accessory.archivedAt && mayRestore("accessory_item", session.role) ? (
                  <form action={restoreAccessoryItemAction} className="mt-3">
                    <input type="hidden" name="orderId" value={id} />
                    <input type="hidden" name="accessoryItemId" value={accessory.id} />
                    <input type="hidden" name="version" value={accessory.version} />
                    <Button type="submit" variant="outline" aria-label={`Restore ${accessory.label}`}>
                      Restore Accessory
                    </Button>
                  </form>
                ) : null}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              className="mt-4"
              title="No Accessories yet"
              description="Add shoes, watches, or anything else sourced alongside the garments."
            />
          )}
        </div>

        <aside>
          <h2 className="section-title">Add an Accessory</h2>
          {canConfigure ? (
            <form action={createAccessoryItemAction} className="mt-4 space-y-4 border-t border-[#d9d8d1] pt-5">
              <input type="hidden" name="orderId" value={id} />
              <label className="form-group">
                <span>Type</span>
                <NativeSelect name="accessoryTypeId" required>
                  {types.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </NativeSelect>
              </label>
              <label className="form-group">
                <span>
                  Label <span className="font-normal text-[#50586c]">(optional)</span>
                </span>
                <Input name="customLabel" maxLength={120} placeholder="e.g. Black oxfords, size 44" />
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
                  Notes <span className="font-normal text-[#50586c]">(optional)</span>
                </span>
                <textarea name="notes" className={textareaClass} />
              </label>
              <Button className="w-full" type="submit">
                Add Accessory
              </Button>
            </form>
          ) : null}
        </aside>
      </section>
    </div>
  );
}
