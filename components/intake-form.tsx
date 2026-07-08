"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { GlassDropdown } from "@/components/glass-dropdown";
import {
  BUDGET_RANGES,
  CONTACT_CHANNELS,
  EVENT_TYPES,
} from "@/lib/intake-options";

type IntakeFormProps = {
  token: string;
  error?: string;
};

export function IntakeForm({ token, error }: IntakeFormProps) {
  const [whatsappSame, setWhatsappSame] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <form
      method="post"
      action={`/intake/${encodeURIComponent(token)}/submit`}
      onSubmit={() => setIsSubmitting(true)}
      className="mt-8 space-y-6"
    >
      {error ? (
        <div className="rounded-2xl border border-kuartz-line bg-white/70 px-4 py-3 text-sm font-semibold text-kuartz-navy shadow-sm">
          {error}
        </div>
      ) : null}

      <label className="block space-y-3">
        <span className="label">Full name</span>
        <input
          className="field"
          name="fullName"
          required
          autoComplete="name"
          placeholder="Enter full name"
        />
      </label>

      <div className="grid gap-5 md:grid-cols-2">
        <label className="block space-y-3">
          <span className="label">Primary phone</span>
          <input
            className="field"
            name="primaryPhone"
            required
            inputMode="tel"
            autoComplete="tel"
            placeholder="Enter phone number"
          />
        </label>

        <label className="block space-y-3">
          <span className="label">Email</span>
          <input
            className="field"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="Enter email address"
          />
        </label>
      </div>

      <label className="checkbox-field">
        <input
          type="checkbox"
          name="whatsappSameAsPrimary"
          checked={whatsappSame}
          onChange={(event) => setWhatsappSame(event.target.checked)}
          className="h-5 w-5 rounded border-kuartz-line accent-kuartz-navy"
        />
        WhatsApp same as primary number
      </label>

      {!whatsappSame ? (
        <label className="block space-y-3">
          <span className="label">WhatsApp number</span>
          <input
            className="field"
            name="whatsappPhone"
            inputMode="tel"
            autoComplete="tel"
            placeholder="Enter WhatsApp number"
          />
        </label>
      ) : null}

      <div className="grid gap-5 md:grid-cols-3">
        <GlassDropdown
          label="Contact channel"
          name="preferredContactChannel"
          options={CONTACT_CHANNELS}
        />
        <GlassDropdown label="Event type" name="eventType" options={EVENT_TYPES} />
        <GlassDropdown label="Budget range" name="budgetRange" options={BUDGET_RANGES} />
      </div>

      <label className="block space-y-3">
        <span className="label">What do you need help with?</span>
        <textarea
          className="field min-h-40 resize-y leading-6"
          name="brief"
          placeholder="Share outfit, occasion, date, styling needs, or anything useful."
        />
      </label>

      <div className="flex justify-end pt-4">
        <button type="submit" disabled={isSubmitting} className="primary-action w-full sm:w-auto">
          {isSubmitting ? "Sending" : "Continue"}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </form>
  );
}