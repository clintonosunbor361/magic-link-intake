import { createClientAction } from "@/app/actions/clients";
import { NewClientForm } from "@/components/clients/new-client-form";
import { requireStaffSession } from "@/lib/auth/session";
import { BUDGET_RANGES, CONTACT_CHANNELS, EVENT_TYPES } from "@/lib/intake-options";
import { listStaffMembers } from "@/lib/team/repository";

export default async function NewClientPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireStaffSession();
  const [{ error }, staff] = await Promise.all([searchParams, listStaffMembers(session.organizationId)]);

  return (
    <div>
      <header className="border-b border-kuartz-line pb-8">
        <p className="eyebrow">Clients</p>
        <h1 className="page-title">Add Client</h1>
        <p className="page-description">
          Capture a contact once. Add an Order later when price and scope are agreed.
        </p>
      </header>
      {error ? <p className="form-alert mt-6" role="alert">{error}</p> : null}
      <NewClientForm
        action={createClientAction}
        staff={staff}
        contactChannels={CONTACT_CHANNELS}
        eventTypes={EVENT_TYPES}
        budgetRanges={BUDGET_RANGES}
      />
    </div>
  );
}
