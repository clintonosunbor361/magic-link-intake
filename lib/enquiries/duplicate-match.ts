export type DuplicateCandidate = {
  id: string;
  kind: "enquiry" | "client";
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

const NAME_TOKEN_OVERLAP_THRESHOLD = 0.5;
const NAME_EDIT_DISTANCE_THRESHOLD = 2;

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeName(name: string): string {
  const tokens = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort();
  return tokens.join(" ");
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

  for (const candidate of candidates) {
    if (input.primaryPhoneNormalized && input.primaryPhoneNormalized === candidate.primaryPhoneNormalized) {
      matches.push({ candidate, strength: "strong", reason: "phone" });
      continue;
    }

    if (input.emailNormalized && input.emailNormalized === candidate.emailNormalized) {
      matches.push({ candidate, strength: "strong", reason: "email" });
      continue;
    }

    if (input.nameNormalized === candidate.nameNormalized) {
      matches.push({ candidate, strength: "weak", reason: "exact_name" });
      continue;
    }

    if (isSimilarName(input.nameNormalized, candidate.nameNormalized)) {
      matches.push({ candidate, strength: "weak", reason: "similar_name" });
    }
  }

  return matches;
}

function isSimilarName(a: string, b: string): boolean {
  const tokensA = a.split(" ").filter(Boolean);
  const tokensB = b.split(" ").filter(Boolean);

  if (tokensA.length >= 2 && tokensB.length >= 2) {
    const setB = new Set(tokensB);
    const shared = tokensA.filter((token) => setB.has(token)).length;
    if (shared / Math.min(tokensA.length, tokensB.length) >= NAME_TOKEN_OVERLAP_THRESHOLD) {
      return true;
    }
  }

  return levenshteinDistance(a, b) <= NAME_EDIT_DISTANCE_THRESHOLD;
}

function levenshteinDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const distances: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));

  for (let i = 0; i < rows; i += 1) distances[i][0] = i;
  for (let j = 0; j < cols; j += 1) distances[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      distances[i][j] = Math.min(
        distances[i - 1][j] + 1,
        distances[i][j - 1] + 1,
        distances[i - 1][j - 1] + cost,
      );
    }
  }

  return distances[rows - 1][cols - 1];
}
