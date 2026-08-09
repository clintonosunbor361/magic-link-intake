import { AuthFrame } from "@/components/auth/auth-frame";

export default function SetupPage() {
  return (
    <AuthFrame eyebrow="Configuration required" title="Connect the production services" description="The CRM is fail-closed until Supabase authentication and Postgres are configured.">
      <div className="border-l-2 border-kuartz-lime bg-white/70 p-5 text-sm leading-7 text-kuartz-secondary">
        Copy <code>.env.example</code> to <code>.env.local</code>, add the Supabase and database values, run <code>npm run db:migrate</code>, and provision the first organization and Super Admin.
      </div>
    </AuthFrame>
  );
}
