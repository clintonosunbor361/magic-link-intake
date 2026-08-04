import { updatePasswordAction } from "@/app/actions/auth";
import { AuthFrame } from "@/components/auth/auth-frame";

export default async function UpdatePasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <AuthFrame eyebrow="Account recovery" title="Choose a new password" description="Use at least ten characters and avoid a password you use elsewhere.">
      {error ? <p className="form-alert" role="alert">{error}</p> : null}
      <form action={updatePasswordAction} className="space-y-5">
        <label className="form-group"><span>New password</span><input className="app-input" name="password" type="password" minLength={10} autoComplete="new-password" required /><small>At least 10 characters.</small></label>
        <button className="app-button w-full" type="submit">Update password</button>
      </form>
    </AuthFrame>
  );
}
