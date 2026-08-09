"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readFormString } from "@/lib/forms/read-string";

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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/auth/callback?next=/auth/update-password`,
  });
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
