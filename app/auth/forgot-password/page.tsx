import Link from "next/link";
import { requestPasswordResetAction } from "@/app/actions/auth";
import { AuthFrame } from "@/components/auth/auth-frame";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const { sent } = await searchParams;
  return (
    <AuthFrame eyebrow="Account recovery" title="Reset your password" description="We’ll email a secure, short-lived recovery link to your staff address.">
      {sent ? <p className="form-success">If the address belongs to a staff account, a recovery link is on its way.</p> : (
        <form action={requestPasswordResetAction} className="space-y-5">
          <label className="form-group"><span>Email address</span><input className="app-input" name="email" type="email" autoComplete="email" required /></label>
          <button className="app-button w-full" type="submit">Send recovery link</button>
        </form>
      )}
      <Link href="/auth/sign-in" className="mt-6 inline-block text-sm font-semibold text-[#50586c] hover:text-[#171b36]">Back to sign in</Link>
    </AuthFrame>
  );
}
