import { updatePasswordAction } from "@/app/actions/auth";
import { AuthFrame } from "@/components/auth/auth-frame";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; context?: string }>;
}) {
  const { error, context } = await searchParams;
  const isInvite = context === "invite";
  return (
    <AuthFrame
      eyebrow={isInvite ? "Welcome to Kuartz" : "Account recovery"}
      title={isInvite ? "Set up your account" : "Choose a new password"}
      description={
        isInvite
          ? "Create a password to finish setting up your staff account."
          : "Use at least ten characters and avoid a password you use elsewhere."
      }
    >
      {error ? <p className="form-alert" role="alert">{error}</p> : null}
      <form action={updatePasswordAction} className="space-y-5">
        {isInvite ? <input type="hidden" name="context" value="invite" /> : null}
        <label className="form-group"><span>New password</span><PasswordInput name="password" aria-label="New password" minLength={10} autoComplete="new-password" required /><small>At least 10 characters.</small></label>
        <Button className="w-full" type="submit">{isInvite ? "Create account" : "Update password"}</Button>
      </form>
    </AuthFrame>
  );
}
