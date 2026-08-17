"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  DuplicateCheckFields,
  type DuplicateMatchView,
} from "@/components/enquiries/duplicate-check-fields";
import type { BUDGET_RANGES, CONTACT_CHANNELS, EVENT_TYPES } from "@/lib/intake-options";

type StaffOption = {
  userId: string;
  fullName: string;
};

type LinkedClient = {
  id: string;
  fullName: string;
  primaryPhone: string;
  email: string | null;
} | null;

type DuplicateCheckResponse = {
  matches?: DuplicateMatchView[];
};

export function NewEnquiryForm({
  action,
  staff,
  linkedClient,
  contactChannels,
  eventTypes,
  budgetRanges,
}: {
  action: (formData: FormData) => void | Promise<void>;
  staff: StaffOption[];
  linkedClient: LinkedClient;
  contactChannels: typeof CONTACT_CHANNELS;
  eventTypes: typeof EVENT_TYPES;
  budgetRanges: typeof BUDGET_RANGES;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const allowSubmitRef = useRef(false);
  const [modalMatches, setModalMatches] = useState<DuplicateMatchView[]>([]);
  const [checking, setChecking] = useState(false);
  const [duplicateStatus, setDuplicateStatus] = useState<string | null>(null);

  async function checkDuplicates(form: HTMLFormElement) {
    const formData = new FormData(form);
    const response = await fetch("/api/enquiries/duplicate-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: String(formData.get("fullName") ?? ""),
        primaryPhone: String(formData.get("primaryPhone") ?? ""),
        email: String(formData.get("email") ?? ""),
      }),
    });
    const data = (await response.json()) as DuplicateCheckResponse;
    return data.matches ?? [];
  }

  function continueWithDuplicate() {
    const form = formRef.current;
    if (!form) return;
    const acknowledged = form.elements.namedItem("acknowledgedDuplicates") as HTMLInputElement | null;
    if (acknowledged) acknowledged.value = "on";
    allowSubmitRef.current = true;
    setModalMatches([]);
    form.requestSubmit();
  }

  return (
    <>
      <form
        ref={formRef}
        action={action}
        className="mt-9 max-w-2xl space-y-5"
        onSubmit={async (event) => {
          if (linkedClient || allowSubmitRef.current) {
            allowSubmitRef.current = false;
            return;
          }

          event.preventDefault();
          const form = event.currentTarget;
          const acknowledged = form.elements.namedItem("acknowledgedDuplicates") as HTMLInputElement | null;
          if (acknowledged?.value === "on") {
            allowSubmitRef.current = true;
            form.requestSubmit();
            return;
          }

          setChecking(true);
          try {
            const matches = await checkDuplicates(form);
            if (matches.length) {
              setModalMatches(matches);
              setDuplicateStatus(null);
              return;
            }
            allowSubmitRef.current = true;
            form.requestSubmit();
          } finally {
            setChecking(false);
          }
        }}
      >
        <input type="hidden" name="acknowledgedDuplicates" value="" />
        {linkedClient ? <input type="hidden" name="linkedClientId" value={linkedClient.id} /> : null}
        <DuplicateCheckFields
          linkedClient={Boolean(linkedClient)}
          initialValues={
            linkedClient
              ? { fullName: linkedClient.fullName, primaryPhone: linkedClient.primaryPhone, email: linkedClient.email ?? "" }
              : undefined
          }
          onIdentityChange={() => setDuplicateStatus(null)}
          onDuplicateMatches={(matches) => {
            if (matches.length) {
              setModalMatches(matches);
              setDuplicateStatus(null);
            } else {
              setDuplicateStatus("No existing matches found.");
            }
          }}
        />
        {duplicateStatus ? <p className="text-sm font-medium text-[#4f6528]">{duplicateStatus}</p> : null}

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
              {contactChannels.map((channel) => (
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
              {eventTypes.map((eventType) => (
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
              {budgetRanges.map((range) => (
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
          <Button type="submit" disabled={checking}>
            {checking ? "Checking..." : "Create Enquiry"}
          </Button>
        </div>
      </form>

      {modalMatches.length ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-kuartz-ink/30 px-4 py-8 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="duplicate-dialog-title"
        >
          <div className="w-full max-w-xl rounded-[1.2rem] border border-kuartz-line bg-[#fbfaf7] p-6 shadow-[0_28px_80px_rgba(24,24,38,0.2)]">
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f7e5e3] text-kuartz-danger">
                  <AlertTriangle size={21} aria-hidden="true" />
                </span>
                <div>
                  <p className="eyebrow">Duplicate Check</p>
                  <h2 id="duplicate-dialog-title" className="mt-1 text-2xl font-extrabold text-kuartz-ink">
                    Possible existing contact
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-kuartz-secondary">
                    Review these matches before creating a new Enquiry.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalMatches([])}
                className="rounded-full p-2 text-kuartz-secondary hover:bg-white hover:text-kuartz-ink"
                aria-label="Close duplicate check"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="mt-5 space-y-2">
              {modalMatches.map((match) => {
                const reason =
                  match.reason === "phone"
                    ? "Same phone number"
                    : match.reason === "email"
                      ? "Same email address"
                      : match.reason === "exact_name"
                        ? "Same name"
                        : "Similar name";
                return (
                  <div key={`${match.candidate.kind}-${match.candidate.id}`} className="rounded-[0.8rem] border border-kuartz-line bg-white/80 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-kuartz-ink">{match.candidate.fullName}</p>
                      <span className="rounded-full border border-kuartz-control px-2.5 py-1 text-xs font-semibold text-kuartz-secondary">
                        {match.candidate.kind === "client" ? "Client" : "Enquiry"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-kuartz-secondary">
                      {match.candidate.primaryPhone}
                      {match.candidate.email ? ` - ${match.candidate.email}` : ""}
                    </p>
                    <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-kuartz-danger">{reason}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setModalMatches([])}>
                Go back
              </Button>
              <Button type="button" onClick={continueWithDuplicate}>
                Create anyway
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
