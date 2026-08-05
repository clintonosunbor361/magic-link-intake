import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth/session";
import { searchClients } from "@/lib/enquiries/repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getStaffSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  if (!query) return NextResponse.json({ clients: [] });

  const clients = await searchClients(session.organizationId, query);
  return NextResponse.json({ clients });
}
