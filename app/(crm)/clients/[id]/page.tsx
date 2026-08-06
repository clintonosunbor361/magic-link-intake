import Link from "next/link";
import { notFound } from "next/navigation";
import { archiveClientAction, restoreClientAction, updateClientAction } from "@/app/actions/clients";
import { requireStaffSession } from "@/lib/auth/session";
import { mayArchive, mayRestore } from "@/lib/domain/record-lifecycle";
import { getClient, listOrdersForClient } from "@/lib/clients/repository";
import { formatMinorUnits } from "@/lib/forms/money";
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

  const orders = await listOrdersForClient(session.organizationId, id);
  const isArchived = Boolean(client.archivedAt);

  return (
    <div>
      <header className="border-b border-[#d9d8d1] pb-8">
        <p className="eyebrow">Client</p>
        <h1 className="page-title">{client.fullName}</h1>
        <p className="page-description">Client since {dateFormatter.format(client.createdAt)}</p>
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
            <form action={updateClientAction} className="mt-4 space-y-4 border-y border-[#d9d8d1] py-5">
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
                    WhatsApp <span className="font-normal text-[#50586c]">(optional)</span>
                  </span>
                  <Input name="whatsappPhone" defaultValue={client.whatsappPhone ?? ""} />
                </label>
                <label className="form-group">
                  <span>
                    Email <span className="font-normal text-[#50586c]">(optional)</span>
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
            <h2 className="section-title">Order history</h2>
            <div className="mt-4 divide-y divide-[#d9d8d1] border-y border-[#d9d8d1]">
              {orders.length ? (
                orders.map((order) => (
                  <div
                    key={order.id}
                    className="grid gap-1 py-4 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                  >
                    <div>
                      <Link href={`/orders/${order.id}`} className="font-semibold text-[#171b36] hover:underline">
                        {order.title}
                      </Link>
                      <p className="mt-1 text-[#50586c]">
                        {order.eventType} · {dateFormatter.format(order.createdAt)}
                        {order.archivedAt ? " · Archived" : ""}
                      </p>
                    </div>
                    <p className="text-[#171b36]">₦{formatMinorUnits(order.finalAgreedPriceMinor)}</p>
                  </div>
                ))
              ) : (
                <p className="py-8 text-sm text-[#767b89]">No Orders yet for this Client.</p>
              )}
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
