"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";

type InviteState = "loading" | "ready" | "saving" | "invalid";

export function validateInvitePasswords(password: string, confirmation: string): string | null {
  if (password.length < 10) return "Use at least 10 characters.";
  if (password !== confirmation) return "The passwords do not match.";
  return null;
}

export function InviteAcceptanceForm() {
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [state, setState] = useState<InviteState>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !publishableKey) {
      setState("invalid");
      return;
    }

    const supabase = createClient(url, publishableKey, {
      auth: { flowType: "implicit", detectSessionInUrl: true, persistSession: true },
    });
    setClient(supabase);

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError || !data.session) {
        setState("invalid");
        return;
      }
      setState("ready");
    });
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client || state !== "ready") return;

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirmation = String(formData.get("passwordConfirmation") ?? "");
    const validationError = validateInvitePasswords(password, confirmation);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setState("saving");
    const { error: updateError } = await client.auth.updateUser({ password });
    if (updateError) {
      setError("The password could not be created. Request a new invitation and try again.");
      setState("ready");
      return;
    }

    await client.auth.signOut();
    window.location.assign("/auth/sign-in?invite=complete");
  }

  if (state === "loading") {
    return <p className="py-5 text-center text-sm text-kuartz-secondary" role="status">Validating your invitation…</p>;
  }

  if (state === "invalid") {
    return (
      <div className="space-y-4 text-center" role="alert">
        <p className="form-alert">This invitation is invalid or expired.</p>
        <a className="inline-flex min-h-11 items-center font-semibold text-kuartz-ink underline" href="/auth/sign-in">Return to sign in</a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {error ? <p className="form-alert" role="alert">{error}</p> : null}
      <label className="form-group">
        <span>New password</span>
        <PasswordInput name="password" aria-label="New password" minLength={10} autoComplete="new-password" required />
        <small>At least 10 characters.</small>
      </label>
      <label className="form-group">
        <span>Confirm password</span>
        <PasswordInput name="passwordConfirmation" aria-label="Confirm password" minLength={10} autoComplete="new-password" required />
      </label>
      <Button className="w-full" type="submit" disabled={state === "saving"}>
        {state === "saving" ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
