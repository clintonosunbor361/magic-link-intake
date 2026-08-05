"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type DuplicateMatchView = {
  candidate: {
    id: string;
    kind: "enquiry" | "client";
    fullName: string;
    primaryPhone: string;
    email: string | null;
  };
  strength: "strong" | "weak";
  reason: "phone" | "email" | "exact_name" | "similar_name";
};

export function DuplicateCheckFields() {
  const [fullName, setFullName] = useState("");
  const [primaryPhone, setPrimaryPhone] = useState("");
  const [email, setEmail] = useState("");
  const [matches, setMatches] = useState<DuplicateMatchView[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  async function checkDuplicates() {
    setChecking(true);
    try {
      const response = await fetch("/api/enquiries/duplicate-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, primaryPhone, email }),
      });
      const data = (await response.json()) as { matches?: DuplicateMatchView[] };
      setMatches(data.matches ?? []);
      setAcknowledged(false);
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="space-y-5">
      <label className="form-group">
        <span>Full name</span>
        <Input
          name="fullName"
          value={fullName}
          onChange={(event) => {
            setFullName(event.target.value);
            setMatches(null);
          }}
          required
        />
      </label>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="form-group">
          <span>Primary phone</span>
          <Input
            name="primaryPhone"
            inputMode="tel"
            value={primaryPhone}
            onChange={(event) => {
              setPrimaryPhone(event.target.value);
              setMatches(null);
            }}
            required
          />
        </label>
        <label className="form-group">
          <span>Email <span className="font-normal text-[#50586c]">(optional)</span></span>
          <Input
            name="email"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setMatches(null);
            }}
          />
        </label>
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={checkDuplicates}
        disabled={checking || !fullName.trim() || !primaryPhone.trim()}
      >
        {checking ? "Checking…" : "Check for duplicates"}
      </Button>
      {matches ? (
        matches.length ? (
          <div className="space-y-2 rounded-[0.8rem] border border-[#d9aaa7] bg-[#f7e5e3] p-4">
            <p className="text-sm font-semibold text-[#7e403d]">Possible existing contacts found:</p>
            <ul className="space-y-1 text-sm text-[#7e403d]">
              {matches.map((match) => (
                <li key={`${match.candidate.kind}-${match.candidate.id}`}>
                  {match.candidate.fullName} · {match.candidate.primaryPhone}
                  {match.candidate.email ? ` · ${match.candidate.email}` : ""} —{" "}
                  {match.strength === "strong"
                    ? match.reason === "phone"
                      ? "same phone number"
                      : "same email address"
                    : "similar name"}{" "}
                  ({match.candidate.kind === "client" ? "existing Client" : "existing Enquiry"})
                </li>
              ))}
            </ul>
            <label className="flex items-center gap-2 text-sm font-semibold text-[#7e403d]">
              <input
                type="checkbox"
                name="acknowledgedDuplicates"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
              />
              I&apos;ve reviewed these and want to create this Enquiry anyway.
            </label>
          </div>
        ) : (
          <p className="text-sm font-medium text-[#4f6528]">No existing matches found.</p>
        )
      ) : null}
    </div>
  );
}
