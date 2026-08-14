import Link from "next/link";
import { requestPasswordResetAction } from "@/app/actions/auth";
import { AuthFrame } from "@/components/auth/auth-frame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  const { sent, error } = await searchParams;
  return (
    <AuthFrame eyebrow="Account recovery" title="Reset your password" description="We’ll email a secure, short-lived recovery link to your staff address.">
      {error ? <p className="form-alert" role="alert">We couldn&apos;t process that request right now. Try again or contact an administrator.</p> : null}
      {sent ? <p className="form-success">If the address belongs to a staff account, a recovery link is on its way.</p> : (
        <form action={requestPasswordResetAction} className="space-y-5">
          <label className="form-group"><span>Email address</span><Input name="email" type="email" autoComplete="email" required /></label>
          <Button className="w-full" type="submit">Send recovery link</Button>
        </form>
      )}
      <Link href="/auth/sign-in" className="mt-6 inline-block text-sm font-semibold text-kuartz-secondary hover:text-kuartz-ink">Back to sign in</Link>
    </AuthFrame>
  );
}
