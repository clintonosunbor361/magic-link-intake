import Link from "next/link";
import { createActiveOrderAction } from "@/app/actions/orders";
import { ClientPicker } from "@/components/enquiries/client-picker";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { NativeSelect } from "@/components/ui/native-select";
import { requireStaffSession } from "@/lib/auth/session";
import { EVENT_TYPES } from "@/lib/intake-options";
import { listStaffMembers } from "@/lib/team/repository";

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireStaffSession();
  const [{ error }, staff] = await Promise.all([
    searchParams,
    listStaffMembers(session.organizationId),
  ]);

  return (
    <div>
      <Breadcrumbs items={[{ label: "Orders", href: "/orders" }, { label: "Add Order" }]} />
      <header className="mt-4 border-b border-kuartz-line pb-8">
        <p className="eyebrow">Confirmed work</p>
        <h1 className="page-title">Add Order</h1>
        <p className="page-description">
          Create an Active Order for an existing Client once price and scope are agreed.
        </p>
      </header>

      {error ? <p className="form-alert mt-6" role="alert">{error}</p> : null}

      <form action={createActiveOrderAction} className="mt-9 max-w-2xl space-y-8">
        <input type="hidden" name="creationSource" value="orders" />

        <section>
          <h2 className="section-title">Client</h2>
          <p className="mt-1 text-sm leading-6 text-kuartz-secondary">
            Search by Client name or phone, then select the correct Client before continuing.
          </p>
          <div className="mt-4">
            <ClientPicker
              fieldName="clientId"
              noResultsMessage="No matching active Clients. Add the Client before creating an Order."
            />
          </div>
        </section>

        <section>
          <h2 className="section-title">Active Order</h2>
          <div className="mt-4 space-y-4">
            <label className="form-group"><span>Order title</span><Input name="title" required /></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="form-group">
                <span>Event type</span>
                <NativeSelect name="eventType" required defaultValue="">
                  <option value="" disabled>Select event type</option>
                  {EVENT_TYPES.map((value) => <option key={value}>{value}</option>)}
                </NativeSelect>
              </label>
              <label className="form-group"><span>Final agreed price (₦)</span><MoneyInput name="finalAgreedPrice" required /></label>
            </div>
            <label className="form-group">
              <span>Primary owner</span>
              <NativeSelect name="primaryOwnerStaffId" defaultValue={session.userId} required>
                {staff.map((member) => <option key={member.userId} value={member.userId}>{member.fullName}</option>)}
              </NativeSelect>
            </label>
            <label className="checkbox-field"><input type="checkbox" name="ffDiscount" className="h-5 w-5" />Friends &amp; Family discount</label>
            <label className="form-group">
              <span>Amount discounted (₦) <span className="font-normal text-kuartz-secondary">(optional)</span></span>
              <MoneyInput name="ffDiscountAmount" />
            </label>
          </div>
        </section>

        <section>
          <h2 className="section-title">First Look</h2>
          <div className="mt-4 space-y-4">
            <label className="form-group"><span>Look name</span><Input name="lookName" required /></label>
            <label className="form-group"><span>Look date <span className="font-normal text-kuartz-secondary">(optional)</span></span><Input name="lookDate" type="date" /></label>
            <label className="form-group"><span>Notes <span className="font-normal text-kuartz-secondary">(optional)</span></span><Input name="lookNotes" /></label>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/orders" className="inline-flex min-h-11 items-center text-sm font-semibold text-kuartz-secondary hover:text-kuartz-ink">Cancel</Link>
          <Button type="submit" pendingLabel="Creating Order…">Create Order</Button>
        </div>
      </form>
    </div>
  );
}
