import Link from "next/link";
import { createInternalEnquiryAction } from "@/app/actions/enquiries";
import { requireStaffSession } from "@/lib/auth/session";
import { listStaffMembers } from "@/lib/team/repository";
import { BUDGET_RANGES, CONTACT_CHANNELS, EVENT_TYPES } from "@/lib/intake-options";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { DuplicateCheckFields } from "@/components/enquiries/duplicate-check-fields";
import { getClient } from "@/lib/clients/repository";

export default async function NewEnquiryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; clientId?: string }>;
}) {
  const session = await requireStaffSession();
  const { error, clientId } = await searchParams;
  const staff = await listStaffMembers(session.organizationId);
  const linkedClient = clientId ? await getClient(session.organizationId, clientId) : null;

  return (
    <div>
      <header className="border-b border-kuartz-line pb-8">
        <p className="eyebrow">Enquiries</p>
        <h1 className="page-title">New Enquiry</h1>
        <p className="page-description">{linkedClient ? `Capture tentative new work for ${linkedClient.fullName}.` : "Capture a person who has contacted Kuartz directly."}</p>
      </header>
      {error ? (
        <p className="form-alert mt-6" role="alert">
          {error}
        </p>
      ) : null}
      <form action={createInternalEnquiryAction} className="mt-9 max-w-2xl space-y-5">
        {linkedClient ? <input type="hidden" name="linkedClientId" value={linkedClient.id} /> : null}
        <DuplicateCheckFields linkedClient={Boolean(linkedClient)} initialValues={linkedClient ? { fullName: linkedClient.fullName, primaryPhone: linkedClient.primaryPhone, email: linkedClient.email ?? "" } : undefined} />

        <label className="checkbox-field">
          <input type="checkbox" name="whatsappSameAsPrimary" defaultChecked className="h-5 w-5" />
          WhatsApp same as primary number
        </label>
        <label className="form-group">
          <span>WhatsApp number <span className="font-normal text-kuartz-secondary">(optional)</span></span>
          <Input name="whatsappPhone" />
        </label>

        <div className="grid gap-5 sm:grid-cols-3">
          <label className="form-group">
            <span>Contact channel</span>
            <NativeSelect name="preferredContactChannel" defaultValue="" required>
              <option value="" disabled>
                Select channel
              </option>
              {CONTACT_CHANNELS.map((channel) => (
                <option key={channel} value={channel}>
                  {channel}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="form-group">
            <span>Event type</span>
            <NativeSelect name="eventType" defaultValue="" required>
              <option value="" disabled>
                Select event type
              </option>
              {EVENT_TYPES.map((eventType) => (
                <option key={eventType} value={eventType}>
                  {eventType}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="form-group">
            <span>Budget range</span>
            <NativeSelect name="budgetRange" defaultValue="" required>
              <option value="" disabled>
                Select budget range
              </option>
              {BUDGET_RANGES.map((range) => (
                <option key={range} value={range}>
                  {range}
                </option>
              ))}
            </NativeSelect>
          </label>
        </div>

        <label className="form-group">
          <span>Brief</span>
          <textarea
            name="brief"
            className="min-h-[7rem] w-full rounded-[0.8rem] border border-kuartz-control bg-white/70 px-3.5 py-3 text-sm text-kuartz-ink outline-none focus:border-[#88925f] focus:bg-white focus:ring-4 focus:ring-kuartz-lime/20"
          />
        </label>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="form-group">
            <span>Lead source <span className="font-normal text-kuartz-secondary">(optional)</span></span>
            <Input name="leadSource" />
          </label>
          <label className="form-group">
            <span>Primary owner <span className="font-normal text-kuartz-secondary">(optional)</span></span>
            <NativeSelect name="ownerStaffId" defaultValue="">
              <option value="">Unassigned</option>
              {staff.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.fullName}
                </option>
              ))}
            </NativeSelect>
          </label>
        </div>

        <label className="form-group">
          <span>Internal notes <span className="font-normal text-kuartz-secondary">(optional)</span></span>
          <textarea
            name="internalNotes"
            className="min-h-[5rem] w-full rounded-[0.8rem] border border-kuartz-control bg-white/70 px-3.5 py-3 text-sm text-kuartz-ink outline-none focus:border-[#88925f] focus:bg-white focus:ring-4 focus:ring-kuartz-lime/20"
          />
        </label>

        <div className="flex items-center justify-between gap-4">
          <Link href="/enquiries" className="text-sm font-semibold text-kuartz-secondary hover:text-kuartz-ink">
            Cancel
          </Link>
          <Button type="submit">Create Enquiry</Button>
        </div>
      </form>
    </div>
  );
}
