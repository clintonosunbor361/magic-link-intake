import Link from "next/link";
import { signInAction } from "@/app/actions/auth";
import { AuthFrame } from "@/components/auth/auth-frame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <AuthFrame eyebrow="Staff access" title="Sign in" description="Use the staff account assigned to your Kuartz organization.">
      {error ? <p className="form-alert" role="alert">{error}</p> : null}
      <form action={signInAction} className="space-y-5">
        <label className="form-group"><span>Email address</span><Input name="email" type="email" autoComplete="email" required /></label>
        <label className="form-group"><span>Password</span><PasswordInput name="password" aria-label="Password" autoComplete="current-password" required /></label>
        <div className="flex items-center justify-between gap-4">
          <Link href="/auth/forgot-password" className="text-sm font-semibold text-[#50586c] hover:text-[#171b36]">Forgot password?</Link>
          <Button type="submit">Sign in</Button>
        </div>
      </form>
    </AuthFrame>
  );
}
