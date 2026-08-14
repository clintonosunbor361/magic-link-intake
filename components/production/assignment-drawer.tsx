import Link from "next/link";
import {
  assignVendorAction,
  bulkAssignVendorAction,
  reassignVendorAction,
  updateAssignmentTermsAction,
} from "@/app/actions/vendor-assignments";
import { createVendorAction } from "@/app/actions/vendors";
import { UrgencyBadge } from "@/components/production/urgency-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { formatMinorUnits } from "@/lib/forms/money";
import { MoneyInput } from "@/components/ui/money-input";
import type { AssignmentDetail } from "@/lib/production/assignment-repository";
import { describeUrgency } from "@/lib/production/urgency";
import type { VendorListRow } from "@/lib/vendors/repository";

// A <details> disclosure rather than a JS drawer: assignment is an occasional action on a page
// that is already dense, it must work on a phone, and progressive disclosure here costs no
// client-side JavaScript at all.

type VendorOption = Pick<VendorListRow, "id" | "name" | "completedJobs" | "openJobs" | "lastJobDate" | "ratingSummary" | "specialties">;

function VendorOptions({ vendors }: { vendors: VendorOption[] }) {
  return (
    <>
      {vendors.map((vendor) => (
        <option key={vendor.id} value={vendor.id}>
          {vendorSummaryLine(vendor)}
        </option>
      ))}
    </>
  );
}

// A native <select> cannot render a table, so the picker's required context is folded into each
// option's text: specialties, scores, and job counts all stay visible at the moment of choosing.
function vendorSummaryLine(vendor: VendorOption): string {
  const specialties = vendor.specialties.length
    ? vendor.specialties.map((specialty) => specialty.name).join("/")
    : "No specialties";
  const rating =
    vendor.ratingSummary.state === "unrated"
      ? "Not rated"
      : `${vendor.ratingSummary.overall.toFixed(1)}★ (Q${vendor.ratingSummary.quality.toFixed(1)} T${vendor.ratingSummary.timeliness.toFixed(1)} C${vendor.ratingSummary.communication.toFixed(1)})`;
  const jobs = `${vendor.completedJobs} done, ${vendor.openJobs} open`;
  const last = vendor.lastJobDate ? `last ${vendor.lastJobDate}` : "no jobs yet";

  return `${vendor.name} — ${specialties} · ${rating} · ${jobs} · ${last}`;
}

export function ItemAssignmentDrawer({
  orderId,
  itemId,
  itemLabel,
  assignment,
  vendors,
  today,
}: {
  orderId: string;
  itemId: string;
  itemLabel: string;
  assignment: AssignmentDetail | null;
  vendors: VendorOption[];
  today: string;
}) {
  const urgency = assignment ? describeUrgency({ deadline: assignment.deadline, today }) : null;

  return (
    // role="group" takes no name from its content, so the disclosure needs an explicit label —
    // without one a screen reader announces an unnamed group and gives no clue what it contains.
    <details
      className="mt-3 rounded-[0.8rem] border border-[#e6e5df] bg-white/50"
      aria-label={assignment ? `Vendor assignment for ${itemLabel}` : `Assign a Vendor to ${itemLabel}`}
    >
      <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-3.5 py-2.5 text-sm font-semibold text-kuartz-ink marker:text-kuartz-muted">
        {assignment ? (
          <>
            <span>{assignment.vendorName}</span>
            {urgency ? <UrgencyBadge urgency={urgency} deadline={assignment.deadline} /> : null}
            <span className="rounded-full border border-kuartz-line bg-[#f6f6f3] px-2 py-0.5 text-xs font-semibold text-kuartz-secondary">
              {assignment.productionStatusName}
            </span>
          </>
        ) : (
          <span className="text-kuartz-secondary">No Vendor assigned</span>
        )}
      </summary>

      <div className="space-y-6 border-t border-[#e6e5df] px-3.5 py-4">
        {assignment ? (
          <>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-kuartz-muted">Vendor contact</h4>
              <p className="mt-1.5 text-sm text-kuartz-body">
                <Link href={`/vendors/${assignment.vendorId}`} className="underline-offset-4 hover:underline">
                  {assignment.vendorName}
                </Link>
                {assignment.vendorPhone ? ` · ${assignment.vendorPhone}` : ""}
                {assignment.vendorEmail ? ` · ${assignment.vendorEmail}` : ""}
              </p>
              <p className="mt-1 text-sm text-kuartz-secondary">
                {assignment.agreedVendorCostMinor === null
                  ? "No agreed cost recorded"
                  : `Agreed cost ₦${formatMinorUnits(assignment.agreedVendorCostMinor)}`}
              </p>
              <Link
                href={`/production/${assignment.id}`}
                className="mt-2 inline-block text-sm font-semibold text-kuartz-secondary underline-offset-4 transition-colors duration-200 hover:text-kuartz-ink hover:underline"
              >
                Open production detail →
              </Link>
            </div>

            <form action={updateAssignmentTermsAction} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="orderId" value={orderId} />
              <input type="hidden" name="assignmentId" value={assignment.id} />
              <input type="hidden" name="version" value={assignment.version} />
              <label className="form-group">
                <span>Deadline</span>
                <Input type="date" name="deadline" defaultValue={assignment.deadline} required />
              </label>
              <label className="form-group w-36">
                <span>
                  Agreed cost (₦) <span className="font-normal text-kuartz-secondary">(optional)</span>
                </span>
                <MoneyInput
                  name="agreedVendorCostMinor"
                  inputMode="decimal"
                  defaultValue={
                    assignment.agreedVendorCostMinor === null
                      ? ""
                      : formatMinorUnits(assignment.agreedVendorCostMinor)
                  }
                />
              </label>
              <Button type="submit" variant="outline">
                Save terms
              </Button>
            </form>

            <details
              className="rounded-[0.7rem] border border-[#f0dcdc] bg-[#fdf8f8] p-3.5"
              aria-label={`Reassign ${itemLabel} to another Vendor`}
            >
              <summary className="cursor-pointer text-sm font-semibold text-[#8c1d1d]">
                Reassign to another Vendor
              </summary>
              <p className="mt-2 text-sm leading-6 text-[#713c3b]">
                The current assignment is archived. {assignment.vendorName}&apos;s status history,
                production notes and payment records stay with it, and the new Vendor starts fresh at
                the first production status.
              </p>
              <form action={reassignVendorAction} className="mt-3 space-y-3">
                <input type="hidden" name="orderId" value={orderId} />
                <input type="hidden" name="assignmentId" value={assignment.id} />
                <input type="hidden" name="version" value={assignment.version} />
                <label className="form-group">
                  <span>New Vendor</span>
                  {/* Explicit aria-label: a wrapping <label> around a <select> makes the accessible
                      name absorb every option's text, which is unreadable when announced. */}
                  <NativeSelect
                    name="vendorId"
                    required
                    defaultValue=""
                    aria-label={`New Vendor for ${itemLabel}`}
                  >
                    <option value="" disabled>
                      Choose a Vendor
                    </option>
                    <VendorOptions vendors={vendors.filter((vendor) => vendor.id !== assignment.vendorId)} />
                  </NativeSelect>
                </label>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="form-group">
                    {/* Prefilled: the deadline is a commitment to the Client, not to the Vendor
                        being replaced. The agreed cost deliberately starts blank. */}
                    <span>Deadline</span>
                    <Input type="date" name="deadline" defaultValue={assignment.deadline} required />
                  </label>
                  <label className="form-group w-36">
                    <span>
                      Agreed cost (₦) <span className="font-normal text-kuartz-secondary">(optional)</span>
                    </span>
                    <MoneyInput name="agreedVendorCostMinor" />
                  </label>
                </div>
                <label className="form-group">
                  <span>Reason</span>
                  <Input name="reason" required maxLength={200} placeholder="Original Vendor withdrew" />
                </label>
                <Button type="submit" variant="outline">
                  Reassign Item
                </Button>
              </form>
            </details>
          </>
        ) : (
          <>
            <form action={assignVendorAction} className="space-y-3">
              <input type="hidden" name="orderId" value={orderId} />
              <input type="hidden" name="itemId" value={itemId} />
              <label className="form-group">
                <span>Vendor</span>
                <NativeSelect name="vendorId" required defaultValue="" aria-label={`Vendor for ${itemLabel}`}>
                  <option value="" disabled>
                    Choose a Vendor
                  </option>
                  <VendorOptions vendors={vendors} />
                </NativeSelect>
              </label>
              <div className="flex flex-wrap items-end gap-3">
                <label className="form-group">
                  <span>Deadline</span>
                  <Input type="date" name="deadline" required aria-label={`Deadline for ${itemLabel}`} />
                </label>
                <label className="form-group w-36">
                  <span>
                    Agreed cost (₦) <span className="font-normal text-kuartz-secondary">(optional)</span>
                  </span>
                  <MoneyInput name="agreedVendorCostMinor" />
                </label>
                <Button type="submit">Assign Vendor</Button>
              </div>
            </form>

            <details
              className="rounded-[0.7rem] border border-[#e6e5df] p-3.5"
              aria-label={`Quick-create a Vendor for ${itemLabel}`}
            >
              <summary className="cursor-pointer text-sm font-semibold text-kuartz-secondary">
                Vendor not in the list? Quick-create one
              </summary>
              <form action={createVendorAction} className="mt-3 flex flex-wrap items-end gap-3">
                <input type="hidden" name="returnTo" value={`/orders/${orderId}`} />
                <label className="form-group">
                  <span>Name</span>
                  <Input name="name" required maxLength={120} aria-label={`New Vendor name for ${itemLabel}`} />
                </label>
                <label className="form-group">
                  <span>
                    Phone <span className="font-normal text-kuartz-secondary">(optional)</span>
                  </span>
                  <Input name="phone" type="tel" />
                </label>
                <Button type="submit" variant="outline">
                  Create Vendor
                </Button>
              </form>
            </details>
          </>
        )}
      </div>
    </details>
  );
}

export function LookBulkAssignForm({
  orderId,
  lookId,
  lookName,
  unassignedCount,
  vendors,
}: {
  orderId: string;
  lookId: string;
  lookName: string;
  unassignedCount: number;
  vendors: VendorOption[];
}) {
  if (!vendors.length) return null;

  return (
    <details
      className="mt-4 rounded-[0.8rem] border border-[#e6e5df] bg-white/50"
      aria-label={`Bulk assign a Vendor to ${lookName}`}
    >
      <summary className="cursor-pointer px-3.5 py-2.5 text-sm font-semibold text-kuartz-ink">
        Assign a Vendor to this whole Look
      </summary>
      <div className="border-t border-[#e6e5df] px-3.5 py-4">
        <p className="text-sm leading-6 text-kuartz-secondary">
          {unassignedCount
            ? `Assigns the ${unassignedCount} unassigned ${unassignedCount === 1 ? "Item" : "Items"} in ${lookName}. Items that already have a Vendor are skipped — reassign those individually.`
            : `Every Item in ${lookName} already has a Vendor. Reassign individually from each Item.`}
        </p>
        <form action={bulkAssignVendorAction} className="mt-3 space-y-3">
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="lookId" value={lookId} />
          <label className="form-group">
            <span>Vendor</span>
            <NativeSelect
              name="vendorId"
              required
              defaultValue=""
              disabled={!unassignedCount}
              aria-label={`Vendor for every unassigned Item in ${lookName}`}
            >
              <option value="" disabled>
                Choose a Vendor
              </option>
              <VendorOptions vendors={vendors} />
            </NativeSelect>
          </label>
          <div className="flex flex-wrap items-end gap-3">
            <label className="form-group">
              <span>Deadline</span>
              <Input type="date" name="deadline" required disabled={!unassignedCount} />
            </label>
            <label className="form-group w-36">
              <span>
                Agreed cost (₦) <span className="font-normal text-kuartz-secondary">(optional)</span>
              </span>
              <MoneyInput name="agreedVendorCostMinor" disabled={!unassignedCount} />
            </label>
            <Button type="submit" variant="outline" disabled={!unassignedCount}>
              Assign Look
            </Button>
          </div>
        </form>
      </div>
    </details>
  );
}
