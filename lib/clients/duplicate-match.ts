export type DuplicateCandidate = {
  id: string;
  kind: "client";
  fullName: string;
  nameNormalized: string;
  primaryPhone: string;
  primaryPhoneNormalized: string;
  email: string | null;
  emailNormalized: string | null;
};

export type DuplicateMatch = {
  candidate: DuplicateCandidate;
  strength: "strong" | "weak";
  reason: "phone" | "email" | "exact_name" | "similar_name";
};

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizePhone(value: string): string {
  const trimmed = value.trim();
  const hasLeadingPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  if (hasLeadingPlus) return digits;
  if (digits.startsWith("0") && digits.length === 11) return `234${digits.slice(1)}`;
  return digits;
}

export function findDuplicateMatches(
  input: {
    primaryPhoneNormalized: string;
    emailNormalized: string | null;
    nameNormalized: string;
  },
  candidates: DuplicateCandidate[],
): DuplicateMatch[] {
  const matches: DuplicateMatch[] = [];
  const seen = new Set<string>();

  function push(candidate: DuplicateCandidate, strength: DuplicateMatch["strength"], reason: DuplicateMatch["reason"]) {
    if (seen.has(candidate.id)) return;
    seen.add(candidate.id);
    matches.push({ candidate, strength, reason });
  }

  for (const candidate of candidates) {
    if (candidate.primaryPhoneNormalized && candidate.primaryPhoneNormalized === input.primaryPhoneNormalized) {
      push(candidate, "strong", "phone");
      continue;
    }
    if (input.emailNormalized && candidate.emailNormalized === input.emailNormalized) {
      push(candidate, "strong", "email");
      continue;
    }
    if (candidate.nameNormalized === input.nameNormalized) {
      push(candidate, "weak", "exact_name");
      continue;
    }
    if (isSimilarName(candidate.nameNormalized, input.nameNormalized)) {
      push(candidate, "weak", "similar_name");
    }
  }

  return matches;
}

function isSimilarName(left: string, right: string): boolean {
  const leftParts = new Set(left.split(" ").filter(Boolean));
  const rightParts = right.split(" ").filter(Boolean);
  if (!leftParts.size || !rightParts.length) return false;
  const overlap = rightParts.filter((part) => leftParts.has(part)).length;
  return overlap >= Math.min(2, rightParts.length);
}
