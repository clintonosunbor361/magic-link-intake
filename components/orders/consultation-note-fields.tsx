"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { ConsultationNoteDetails, ConsultationNoteTemplate } from "@/lib/consultation-notes/templates";

type SourceOption = { id: string; name: string; template: ConsultationNoteTemplate };

export function ConsultationNoteFields({
  sources,
  initialSourceId,
  initialDetails = {},
}: {
  sources: SourceOption[];
  initialSourceId?: string;
  initialDetails?: ConsultationNoteDetails;
}) {
  const [sourceId, setSourceId] = useState(initialSourceId ?? sources[0]?.id ?? "");
  const [details, setDetails] = useState(initialDetails);
  const template = sources.find((source) => source.id === sourceId)?.template ?? "generic";

  function detailInput(name: keyof ConsultationNoteDetails, label: string, type = "text") {
    const visible =
      (template === "email" && name === "subject") ||
      (template === "reference" && name === "referenceUrl") ||
      (template === "colour" && (name === "colourName" || name === "colourCode"));
    const input = (
      <Input
        name={name}
        type={type}
        value={details[name] ?? ""}
        onChange={(event) => setDetails({ ...details, [name]: event.target.value })}
      />
    );
    if (!visible) return <span key={name} className="hidden">{input}</span>;
    return (
      <label key={name} className="form-group">
        <span>{label} <span className="font-normal text-kuartz-secondary">(optional)</span></span>
        {input}
      </label>
    );
  }

  return (
    <>
      <label className="form-group">
        <span>Source</span>
        <NativeSelect name="sourceId" defaultValue={sourceId} onValueChange={setSourceId}>
          {sources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}
        </NativeSelect>
      </label>
      {detailInput("subject", "Subject")}
      {detailInput("referenceUrl", "Reference URL", "url")}
      {detailInput("colourName", "Colour name")}
      {detailInput("colourCode", "Colour code")}
    </>
  );
}
