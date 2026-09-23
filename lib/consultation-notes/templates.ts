export const CONSULTATION_NOTE_TEMPLATES = ["generic", "email", "reference", "colour"] as const;

export type ConsultationNoteTemplate = (typeof CONSULTATION_NOTE_TEMPLATES)[number];

export type ConsultationNoteDetails = {
  subject?: string;
  referenceUrl?: string;
  colourName?: string;
  colourCode?: string;
};

export const CONSULTATION_NOTE_TEMPLATE_LABELS: Record<ConsultationNoteTemplate, string> = {
  generic: "General note",
  email: "Email",
  reference: "Reference link",
  colour: "Colour reference",
};

export function isConsultationNoteTemplate(value: string): value is ConsultationNoteTemplate {
  return CONSULTATION_NOTE_TEMPLATES.includes(value as ConsultationNoteTemplate);
}

export function normalizeConsultationNoteDetails(details: ConsultationNoteDetails): ConsultationNoteDetails {
  const normalized = Object.fromEntries(
    Object.entries(details)
      .map(([key, value]) => [key, value?.trim()])
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
  ) as ConsultationNoteDetails;

  if (normalized.referenceUrl) {
    let url: URL;
    try {
      url = new URL(normalized.referenceUrl);
    } catch {
      throw new Error("Reference URL must be a valid HTTP or HTTPS URL.");
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("Reference URL must be a valid HTTP or HTTPS URL.");
    }
  }

  return normalized;
}

export function consultationNoteDetailLines(details: ConsultationNoteDetails): string[] {
  return [
    details.subject ? `Subject: ${details.subject}` : null,
    details.referenceUrl ? `Reference: ${details.referenceUrl}` : null,
    details.colourName ? `Colour: ${details.colourName}` : null,
    details.colourCode ? `Colour code: ${details.colourCode}` : null,
  ].filter((line): line is string => Boolean(line));
}
