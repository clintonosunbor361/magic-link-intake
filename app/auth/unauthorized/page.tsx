import { signOutAction } from "@/app/actions/auth";
import { AuthFrame } from "@/components/auth/auth-frame";
import { Button } from "@/components/ui/button";

export default function UnauthorizedPage() {
  return (
    <AuthFrame eyebrow="Membership required" title="This account has no active workspace" description="Your Supabase account is valid, but it is not an active Staff Member of a Kuartz organization.">
      <form action={signOutAction}>
        <Button className="w-full" type="submit">Sign out and use another account</Button>
      </form>
    </AuthFrame>
  );
}
