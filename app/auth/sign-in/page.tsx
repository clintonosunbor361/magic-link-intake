import Link from "next/link";
import { AuthFrame } from "@/components/auth/auth-frame";
import { SignInForm } from "@/components/auth/sign-in-form";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; invite?: string }>;
}) {
  const { reason, invite } = await searchParams;
  const initialError = reason === "invalid_link" ? "This link is invalid or expired." : null;
  return (
    <AuthFrame eyebrow="Staff access" title="Sign in" description="Use the staff account assigned to your Kuartz organization.">
      {invite === "complete" ? <p className="form-success" role="status">Account created. Sign in with your new password.</p> : null}
      <SignInForm initialError={initialError} />
      <Link href="/auth/forgot-password" className="mt-5 inline-block text-sm font-semibold text-kuartz-secondary hover:text-kuartz-ink">Forgot password?</Link>
    </AuthFrame>
  );
}
