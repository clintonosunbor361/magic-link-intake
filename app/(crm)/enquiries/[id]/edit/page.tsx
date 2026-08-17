import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { updateEnquiryDetailsAction } from "@/app/actions/enquiries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { requireStaffSession } from "@/lib/auth/session";
import { getEnquiry } from "@/lib/enquiries/repository";
import { BUDGET_RANGES, CONTACT_CHANNELS, EVENT_TYPES } from "@/lib/intake-options";
import { listStaffMembers } from "@/lib/team/repository";

export default async function EditEnquiryPage({
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

  const staff = await listStaffMembers(session.organizationId);

  return (
    <div>
      <Button asChild variant="ghost" className="mb-3 -ml-2 gap-2">
        <Link href={`/enquiries/${enquiry.id}`}>
          <ArrowLeft size={16} aria-hidden="true" />
          Back to Enquiry
        </Link>
      </Button>
      <header className="border-b border-kuartz-line pb-8">
        <p className="eyebrow">Enquiry</p>
        <h1 className="page-title">Edit {enquiry.fullName}</h1>
        <p className="page-description">Update this Enquiry before it becomes a Client.</p>
      </header>

      {error ? (
        <p className="form-alert mt-6" role="alert">
          {error}
        </p>
      ) : null}

      <form action={updateEnquiryDetailsAction} className="mt-9 max-w-2xl space-y-5">
        <input type="hidden" name="enquiryId" value={enquiry.id} />
        <input type="hidden" name="version" value={enquiry.version} />
        {enquiry.linkedClientId ? <input type="hidden" name="linkedClientId" value={enquiry.linkedClientId} /> : null}

        <label className="form-group">
          <span>Full name</span>
          <Input name="fullName" defaultValue={enquiry.fullName} required />
        </label>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="form-group">
            <span>Primary phone</span>
            <Input name="primaryPhone" inputMode="tel" defaultValue={enquiry.primaryPhone} required />
          </label>
          <label className="form-group">
            <span>Email <span className="font-normal text-kuartz-secondary">(optional)</span></span>
            <Input name="email" type="email" defaultValue={enquiry.email ?? ""} />
          </label>
        </div>

        <label className="checkbox-field">
          <input
            type="checkbox"
            name="whatsappSameAsPrimary"
            defaultChecked={enquiry.whatsappSameAsPrimary}
            className="h-5 w-5"
          />
          WhatsApp same as primary number
        </label>
        <label className="form-group">
          <span>WhatsApp number <span className="font-normal text-kuartz-secondary">(optional)</span></span>
          <Input name="whatsappPhone" defaultValue={enquiry.whatsappPhone ?? ""} />
        </label>

        <div className="grid gap-5 sm:grid-cols-3">
          <label className="form-group">
            <span>Contact channel</span>
            <NativeSelect name="preferredContactChannel" defaultValue={enquiry.preferredContactChannel} required>
              {CONTACT_CHANNELS.map((channel) => (
                <option key={channel} value={channel}>
                  {channel}
                </option>
              ))}
            </NativeSelect>
          </label>
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
            <span>Budget range</span>
            <NativeSelect name="budgetRange" defaultValue={enquiry.budgetRange ?? ""} required>
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
            defaultValue={enquiry.brief}
            className="min-h-[7rem] w-full rounded-[0.8rem] border border-kuartz-control bg-white/70 px-3.5 py-3 text-sm text-kuartz-ink outline-none focus:border-[#88925f] focus:bg-white focus:ring-4 focus:ring-kuartz-lime/20"
          />
        </label>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="form-group">
            <span>Lead source <span className="font-normal text-kuartz-secondary">(optional)</span></span>
            <Input name="leadSource" defaultValue={enquiry.leadSource ?? ""} />
          </label>
          <label className="form-group">
            <span>Primary owner <span className="font-normal text-kuartz-secondary">(optional)</span></span>
            <NativeSelect name="ownerStaffId" defaultValue={enquiry.ownerStaffId ?? ""}>
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
            defaultValue={enquiry.internalNotes ?? ""}
            className="min-h-[5rem] w-full rounded-[0.8rem] border border-kuartz-control bg-white/70 px-3.5 py-3 text-sm text-kuartz-ink outline-none focus:border-[#88925f] focus:bg-white focus:ring-4 focus:ring-kuartz-lime/20"
          />
        </label>

        <div className="flex items-center justify-between gap-4">
          <Link href={`/enquiries/${enquiry.id}`} className="text-sm font-semibold text-kuartz-secondary hover:text-kuartz-ink">
            Cancel
          </Link>
          <Button type="submit">Save Enquiry</Button>
        </div>
      </form>
    </div>
  );
}
