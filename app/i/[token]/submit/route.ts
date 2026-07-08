import { NextRequest } from "next/server";
import { handleIntakeSubmit } from "@/lib/intake-submit";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { token } = await params;
  return handleIntakeSubmit(request, token, "/i");
}
