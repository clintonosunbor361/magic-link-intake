"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readFormString } from "@/lib/forms/read-string";
import { getRequestOrigin } from "@/lib/request-origin";

export type SignInState = { error: string | null };

export async function signInAction(_state: SignInState, formData: FormData): Promise<SignInState> {
  const email = readFormString(formData, "email");
  const password = readFormString(formData, "password");
  if (!email || !password) return { error: "Enter your email and password." };

  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/setup");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "The email or password is incorrect." };
  redirect("/");
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase?.auth.signOut();
  redirect("/auth/sign-in");
}

export async function requestPasswordResetAction(formData: FormData) {
  const email = readFormString(formData, "email");
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/setup");
  const origin = await getRequestOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/auth/update-password`,
  });
  if (error) {
    console.error("Password reset request failed.", { code: error.code, status: error.status });
    redirect("/auth/forgot-password?error=temporary_failure");
  }
  redirect("/auth/forgot-password?sent=1");
}

export async function updatePasswordAction(formData: FormData) {
  const password = readFormString(formData, "password");
  const context = readFormString(formData, "context");
  const contextParam = context === "invite" ? "&context=invite" : "";
  if (password.length < 10) {
    redirect(`/auth/update-password?error=Use+at+least+10+characters.${contextParam}`);
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/setup");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect(`/auth/update-password?error=The+password+could+not+be+updated.${contextParam}`);
  redirect("/");
}
