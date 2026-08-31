import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth/session";
import { searchClients } from "@/lib/clients/repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getStaffSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const requestedLimit = Number(url.searchParams.get("limit") ?? "6");
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 25) : 6;
  if (!query) return NextResponse.json({ clients: [] });

  const clients = await searchClients(session.organizationId, query, limit + 1);
  return NextResponse.json({ clients: clients.slice(0, limit), hasMore: clients.length > limit });
}
