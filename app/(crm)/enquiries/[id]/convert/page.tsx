import { notFound, redirect } from "next/navigation";
import { convertEnquiryAction } from "@/app/actions/enquiry-conversion";
import { requireStaffSession } from "@/lib/auth/session";
import { getEnquiry } from "@/lib/enquiries/repository";
import { listStaffMembers } from "@/lib/team/repository";
import { EVENT_TYPES } from "@/lib/intake-options";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { ClientPicker } from "@/components/enquiries/client-picker";
import { getClient } from "@/lib/clients/repository";
import { MoneyInput } from "@/components/ui/money-input";

export default async function ConvertEnquiryPage({
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
  if (enquiry.convertedAt || enquiry.archivedAt) redirect(`/enquiries/${id}`);

  const [staff, linkedClient] = await Promise.all([listStaffMembers(session.organizationId), enquiry.linkedClientId ? getClient(session.organizationId, enquiry.linkedClientId) : null]);

  return (
    <div>
      <header className="border-b border-kuartz-line pb-8">
        <p className="eyebrow">Enquiry</p>
        <h1 className="page-title">Convert {enquiry.fullName}</h1>
        <p className="page-description">Create a Client and Active Order from this Enquiry. This cannot be undone.</p>
      </header>
      {error ? (
        <p className="form-alert mt-6" role="alert">
          {error}
        </p>
      ) : null}
      <form action={convertEnquiryAction} className="mt-9 max-w-2xl space-y-6">
        <input type="hidden" name="enquiryId" value={enquiry.id} />
        <input type="hidden" name="version" value={enquiry.version} />

        <div>
          <h2 className="section-title">Client</h2>
          <p className="mt-1 text-sm text-kuartz-secondary">
            Link to an existing Client, or leave unselected to create a new Client from this Enquiry&apos;s details.
          </p>
          <div className="mt-4">
            <ClientPicker initialSelected={linkedClient ? { id: linkedClient.id, fullName: linkedClient.fullName, primaryPhone: linkedClient.primaryPhone, email: linkedClient.email, latestOrderTitle: null } : null} />
          </div>
        </div>

        <div>
          <h2 className="section-title">Active Order</h2>
          <div className="mt-4 space-y-4">
            <label className="form-group">
              <span>Order title</span>
              <Input name="title" required defaultValue={`${enquiry.fullName} — ${enquiry.eventType}`} />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="form-group">
                <span>Event type</span>
                <NativeSelect name="eventType" defaultValue={enquiry.eventType} required>
                  {EVENT_TYPES.map((eventType) => (
                    <option key={eventType} value={eventType}>
                      {eventType}
                    </option>
                  ))}
                </NativeSelect>
              </label>
              <label className="form-group">
                <span>Final agreed price (₦)</span>
                <MoneyInput name="finalAgreedPrice" required />
              </label>
            </div>
            <label className="form-group">
              <span>Primary owner</span>
              <NativeSelect name="primaryOwnerStaffId" defaultValue={enquiry.ownerStaffId ?? session.userId} required>
                {staff.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.fullName}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="checkbox-field">
              <input type="checkbox" name="ffDiscount" className="h-5 w-5" />
              Friends &amp; Family discount
            </label>
            <label className="form-group">
              <span>Amount discounted (₦) <span className="font-normal text-kuartz-secondary">(optional)</span></span>
              <MoneyInput name="ffDiscountAmount" />
            </label>
          </div>
        </div>

        <div>
          <h2 className="section-title">First Look</h2>
          <div className="mt-4 space-y-4">
            <label className="form-group">
              <span>Look name</span>
              <Input name="lookName" required placeholder="e.g. Traditional Wedding" />
            </label>
            <label className="form-group">
              <span>Look date <span className="font-normal text-kuartz-secondary">(optional)</span></span>
              <Input name="lookDate" type="date" />
            </label>
            <label className="form-group">
              <span>Notes <span className="font-normal text-kuartz-secondary">(optional)</span></span>
              <Input name="lookNotes" />
            </label>
          </div>
        </div>

        <Button type="submit" className="w-full">
          Convert Enquiry
        </Button>
      </form>
    </div>
  );
}
