import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth/session";
import { createClientRepository } from "@/lib/clients/repository";
import { findDuplicateMatches, normalizeEmail, normalizeName, normalizePhone } from "@/lib/clients/duplicate-match";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getStaffSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { fullName?: string; primaryPhone?: string; email?: string };
  const fullName = body.fullName?.trim() ?? "";
  const primaryPhone = body.primaryPhone?.trim() ?? "";
  const email = body.email?.trim() ?? "";

  if (!fullName || !primaryPhone) {
    return NextResponse.json({ matches: [] });
  }

  const candidates = await createClientRepository().getDuplicateCandidates!(session.organizationId);
  const matches = findDuplicateMatches(
    {
      primaryPhoneNormalized: normalizePhone(primaryPhone),
      emailNormalized: email ? normalizeEmail(email) : null,
      nameNormalized: normalizeName(fullName),
    },
    candidates,
  );

  return NextResponse.json({
    matches: matches.map((match) => ({
      candidate: {
        id: match.candidate.id,
        kind: match.candidate.kind,
        fullName: match.candidate.fullName,
        primaryPhone: match.candidate.primaryPhone,
        email: match.candidate.email,
      },
      strength: match.strength,
      reason: match.reason,
    })),
  });
}
