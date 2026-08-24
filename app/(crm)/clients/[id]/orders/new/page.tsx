import Link from "next/link";
import { notFound } from "next/navigation";
import { createActiveOrderAction } from "@/app/actions/orders";
import { OrderDiscountFields } from "@/components/orders/order-discount-fields";
import { OrderLooksFields } from "@/components/orders/order-looks-fields";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { NativeSelect } from "@/components/ui/native-select";
import { requireStaffSession } from "@/lib/auth/session";
import { getClient } from "@/lib/clients/repository";
import { EVENT_TYPES } from "@/lib/intake-options";
import { listStaffMembers } from "@/lib/team/repository";

export default async function NewClientOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireStaffSession();
  const [{ id }, { error }] = await Promise.all([params, searchParams]);
  const [client, staff] = await Promise.all([
    getClient(session.organizationId, id),
    listStaffMembers(session.organizationId),
  ]);

  if (!client || client.archivedAt) notFound();

  return (
    <div>
      <Breadcrumbs items={[{ label: "Clients", href: "/clients" }, { label: client.fullName, href: `/clients/${id}` }, { label: "New Order" }]} />
      <header className="mt-4 border-b border-kuartz-line pb-8">
        <p className="eyebrow">Already agreed</p>
        <h1 className="page-title">New Order</h1>
        <p className="page-description">
          Create the Order for {client.fullName}, then continue setup from the Order workspace.
        </p>
      </header>

      {error ? <p className="form-alert mt-6" role="alert">{error}</p> : null}

      <form action={createActiveOrderAction} className="mt-9 max-w-2xl space-y-8">
        <input type="hidden" name="clientId" value={id} />

        <section>
          <h2 className="section-title">Order basics</h2>
          <div className="mt-4 space-y-4">
            <label className="form-group">
              <span>Order title</span>
              <Input name="title" required placeholder={`${client.fullName} Wedding`} />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="form-group">
                <span>Event type</span>
                <NativeSelect name="eventType" required defaultValue="">
                  <option value="" disabled>Select event type</option>
                  {EVENT_TYPES.map((value) => <option key={value}>{value}</option>)}
                </NativeSelect>
              </label>
              <label className="form-group">
                <span>Final agreed price (NGN)</span>
                <MoneyInput name="finalAgreedPrice" required />
              </label>
            </div>
            <label className="form-group">
              <span>Primary owner</span>
              <NativeSelect name="primaryOwnerStaffId" defaultValue={session.userId} required>
                {staff.map((member) => <option key={member.userId} value={member.userId}>{member.fullName}</option>)}
              </NativeSelect>
            </label>
            <OrderDiscountFields />
          </div>
        </section>

        <OrderLooksFields />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={`/clients/${id}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-kuartz-secondary hover:text-kuartz-ink">Cancel</Link>
          <Button type="submit" pendingLabel="Creating Order...">Create Order</Button>
        </div>
      </form>
    </div>
  );
}
