import {
  BUDGET_RANGES,
  CONTACT_CHANNELS,
  EVENT_TYPES,
  type BudgetRange,
  type ContactChannel,
  type EventType,
  type IntakeSubmissionInput,
} from "@/lib/intake-options";

export function parseIntakeForm(formData: FormData) {
  const errors: string[] = [];

  const fullName = readString(formData, "fullName");
  const primaryPhone = readString(formData, "primaryPhone");
  const whatsappSameAsPrimary = formData.get("whatsappSameAsPrimary") === "on";
  const rawWhatsappPhone = readString(formData, "whatsappPhone");
  const email = readString(formData, "email");
  const preferredContactChannel = readOption(
    formData,
    "preferredContactChannel",
    CONTACT_CHANNELS,
    "preferred contact channel",
    errors,
  );
  const eventType = readOption(
    formData,
    "eventType",
    EVENT_TYPES,
    "event type",
    errors,
  );
  const budgetRange = readOption(
    formData,
    "budgetRange",
    BUDGET_RANGES,
    "budget range",
    errors,
  );

  if (!fullName) {
    errors.push("Full name is required.");
  }

  if (!primaryPhone) {
    errors.push("Primary phone is required.");
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push("Enter a valid email address or leave it blank.");
  }

  const input: IntakeSubmissionInput = {
    fullName,
    primaryPhone,
    whatsappSameAsPrimary,
    whatsappPhone: whatsappSameAsPrimary ? primaryPhone : rawWhatsappPhone,
    email,
    preferredContactChannel,
    eventType,
    budgetRange,
    brief: readString(formData, "brief"),
  };

  return {
    input,
    errors,
  };
}

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function readOption<T extends readonly string[]>(
  formData: FormData,
  key: string,
  allowed: T,
  label: string,
  errors: string[],
): T[number] {
  const value = readString(formData, key);

  if (allowed.includes(value)) {
    return value as T[number];
  }

  errors.push(`Select a valid ${label}.`);
  return allowed[0];
}

export type ParsedContactChannel = ContactChannel;
export type ParsedEventType = EventType;
export type ParsedBudgetRange = BudgetRange;
