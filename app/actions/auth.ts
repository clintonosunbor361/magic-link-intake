"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function readRequired(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function signInAction(formData: FormData) {
  const email = readRequired(formData, "email");
  const password = readRequired(formData, "password");
  if (!email || !password) redirect("/auth/sign-in?error=Enter+your+email+and+password.");

  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/setup");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/auth/sign-in?error=The+email+or+password+is+incorrect.");
  redirect("/");
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase?.auth.signOut();
  redirect("/auth/sign-in");
}

export async function requestPasswordResetAction(formData: FormData) {
  const email = readRequired(formData, "email");
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/setup");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/auth/callback?next=/auth/update-password`,
  });
  redirect("/auth/forgot-password?sent=1");
}

export async function updatePasswordAction(formData: FormData) {
  const password = readRequired(formData, "password");
  if (password.length < 10) {
    redirect("/auth/update-password?error=Use+at+least+10+characters.");
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/setup");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect("/auth/update-password?error=The+password+could+not+be+updated.");
  redirect("/");
}
