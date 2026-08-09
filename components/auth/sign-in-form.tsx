"use client";

import { useActionState } from "react";
import { signInAction, type SignInState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";

const EMPTY_STATE: SignInState = { error: null };

export function SignInForm({ initialError = null }: { initialError?: string | null }) {
  const [state, action] = useActionState(signInAction, initialError ? { error: initialError } : EMPTY_STATE);

  return (
    <>
      {state.error ? <p className="form-alert" role="alert">{state.error}</p> : null}
      <form action={action} className="space-y-5">
        <label className="form-group"><span>Email address</span><Input name="email" type="email" autoComplete="email" required /></label>
        <label className="form-group"><span>Password</span><PasswordInput name="password" aria-label="Password" autoComplete="current-password" required /></label>
        <div className="flex justify-end">
          <Button type="submit" pendingLabel="Signing in…">Sign in</Button>
        </div>
      </form>
    </>
  );
}
