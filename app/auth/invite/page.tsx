import { AuthFrame } from "@/components/auth/auth-frame";
import { InviteAcceptanceForm } from "@/components/auth/invite-acceptance-form";

export default function InvitePage() {
  return (
    <AuthFrame
      eyebrow="Welcome to Kuartz"
      title="Set up your account"
      description="Create a password to finish setting up your staff account."
    >
      <InviteAcceptanceForm />
    </AuthFrame>
  );
}
