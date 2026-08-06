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
import { requireStaffSession } from "@/lib/auth/session";
import { mayArchive, mayRestore } from "@/lib/domain/record-lifecycle";
import { getOrderWithLooksAndItems } from "@/lib/orders/repository";
import { listItemTypes } from "@/lib/item-types/repository";
import { formatMinorUnits } from "@/lib/forms/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

const dateFormatter = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" });

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
