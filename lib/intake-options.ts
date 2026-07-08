export const CONTACT_CHANNELS = ["WhatsApp", "Phone call", "Email"] as const;

export const EVENT_TYPES = ["Wedding", "Birthday", "Corporate", "Other"] as const;

export const BUDGET_RANGES = [
  "Under 500k",
  "500k to 1M",
  "1M to 2M",
  "Above 2M",
] as const;

export type ContactChannel = (typeof CONTACT_CHANNELS)[number];
export type EventType = (typeof EVENT_TYPES)[number];
export type BudgetRange = (typeof BUDGET_RANGES)[number];

export type IntakeSubmissionInput = {
  fullName: string;
  primaryPhone: string;
  whatsappSameAsPrimary: boolean;
  whatsappPhone: string;
  email: string;
  preferredContactChannel: ContactChannel;
  eventType: EventType;
  budgetRange: BudgetRange;
  brief: string;
};
