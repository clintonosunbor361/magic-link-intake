import { describe, expect, it } from "vitest";
import {
  findDuplicateMatches,
  normalizeEmail,
  normalizeName,
  normalizePhone,
} from "@/lib/enquiries/duplicate-match";

describe("normalizePhone", () => {
  it("strips formatting and keeps the last 10 digits", () => {
    expect(normalizePhone("+234 801 234 5678")).toBe("8012345678");
    expect(normalizePhone("08012345678")).toBe("8012345678");
    expect(normalizePhone("8012345678")).toBe("8012345678");
    expect(normalizePhone("(080) 123-45678")).toBe("8012345678");
  });

  it("returns the digits as-is when shorter than 10", () => {
    expect(normalizePhone("12345")).toBe("12345");
  });
});

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Teni@Example.COM ")).toBe("teni@example.com");
  });
});

describe("normalizeName", () => {
  it("strips diacritics, lowercases, and sorts tokens", () => {
    expect(normalizeName("Adé Bello")).toBe("ade bello");
    expect(normalizeName("Bello Ade")).toBe("ade bello");
  });

  it("collapses punctuation and extra whitespace", () => {
    expect(normalizeName("O'Brien-Smith  Jr.")).toBe("brien jr o smith");
  });
});

describe("findDuplicateMatches", () => {
  const candidates = [
    {
      id: "enq-1",
      kind: "enquiry" as const,
      fullName: "Teni Adesina",
      nameNormalized: normalizeName("Teni Adesina"),
      primaryPhone: "08012345678",
      primaryPhoneNormalized: normalizePhone("08012345678"),
      email: "teni@example.com",
      emailNormalized: normalizeEmail("teni@example.com"),
    },
    {
      id: "client-1",
      kind: "client" as const,
      fullName: "Bukola Adewale",
      nameNormalized: normalizeName("Bukola Adewale"),
      primaryPhone: "07098765432",
      primaryPhoneNormalized: normalizePhone("07098765432"),
      email: null,
      emailNormalized: null,
    },
    {
      id: "enq-2",
      kind: "enquiry" as const,
      fullName: "Ngozi",
      nameNormalized: normalizeName("Ngozi"),
      primaryPhone: "07011111111",
      primaryPhoneNormalized: normalizePhone("07011111111"),
      email: null,
      emailNormalized: null,
    },
  ];

  it("flags a strong match on phone", () => {
    const matches = findDuplicateMatches(
      {
        primaryPhoneNormalized: normalizePhone("+2348012345678"),
        emailNormalized: normalizeEmail("someone-else@example.com"),
        nameNormalized: normalizeName("Someone Else"),
      },
      candidates,
    );
    expect(matches).toContainEqual(
      expect.objectContaining({ candidate: candidates[0], strength: "strong", reason: "phone" }),
    );
  });

  it("flags a strong match on email", () => {
    const matches = findDuplicateMatches(
      {
        primaryPhoneNormalized: normalizePhone("09011112222"),
        emailNormalized: normalizeEmail("TENI@example.com"),
        nameNormalized: normalizeName("Different Name"),
      },
      candidates,
    );
    expect(matches).toContainEqual(
      expect.objectContaining({ candidate: candidates[0], strength: "strong", reason: "email" }),
    );
  });

  it("flags a weak match on an exact normalized name with no phone/email overlap", () => {
    const matches = findDuplicateMatches(
      {
        primaryPhoneNormalized: normalizePhone("09011112222"),
        emailNormalized: null,
        nameNormalized: normalizeName("Adesina Teni"),
      },
      candidates,
    );
    expect(matches).toContainEqual(
      expect.objectContaining({ candidate: candidates[0], strength: "weak", reason: "exact_name" }),
    );
  });

  it("flags a weak match on a similar (typo) name", () => {
    const matches = findDuplicateMatches(
      {
        primaryPhoneNormalized: normalizePhone("09011112222"),
        emailNormalized: null,
        nameNormalized: normalizeName("Bukola Adewalle"),
      },
      candidates,
    );
    expect(matches).toContainEqual(
      expect.objectContaining({ candidate: candidates[1], strength: "weak", reason: "similar_name" }),
    );
  });

  it("flags a weak match on a single-token name typo via edit distance", () => {
    const matches = findDuplicateMatches(
      {
        primaryPhoneNormalized: normalizePhone("09011112222"),
        emailNormalized: null,
        nameNormalized: normalizeName("Ngozy"),
      },
      candidates,
    );
    expect(matches).toContainEqual(
      expect.objectContaining({ candidate: candidates[2], strength: "weak", reason: "similar_name" }),
    );
  });

  it("returns no matches for an unrelated person", () => {
    const matches = findDuplicateMatches(
      {
        primaryPhoneNormalized: normalizePhone("09011112222"),
        emailNormalized: normalizeEmail("nobody@example.com"),
        nameNormalized: normalizeName("Completely Different"),
      },
      candidates,
    );
    expect(matches).toEqual([]);
  });

  it("never returns a strong match without phone or email evidence", () => {
    const matches = findDuplicateMatches(
      {
        primaryPhoneNormalized: normalizePhone("09011112222"),
        emailNormalized: null,
        nameNormalized: normalizeName("Teni Adesina"),
      },
      candidates,
    );
    expect(matches.every((match) => match.strength === "weak")).toBe(true);
  });
});
