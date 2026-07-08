import { NextRequest, NextResponse } from "next/server";
import { parseIntakeForm } from "@/lib/intake-validation";
import { consumeTokenWithSubmission } from "@/lib/magic-links";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { token } = await params;
  const formData = await request.formData();
  const { input, errors } = parseIntakeForm(formData);

  if (errors.length) {
    const url = new URL(`/intake/${token}`, request.url);
    url.searchParams.set("error", errors[0]);

    return NextResponse.redirect(url, { status: 303 });
  }

  const result = consumeTokenWithSubmission(token, input);

  if (!result.ok) {
    return NextResponse.redirect(new URL("/intake/inactive", request.url), {
      status: 303,
    });
  }

  return NextResponse.redirect(new URL("/intake/success", request.url), {
    status: 303,
  });
}
