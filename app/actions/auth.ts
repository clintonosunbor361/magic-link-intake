"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readFormString } from "@/lib/forms/read-string";
import { getRequestOrigin } from "@/lib/request-origin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendPasswordResetEmail } from "@/lib/email/resend";

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
  const email = readFormString(formData, "email").toLowerCase();
  if (!email) redirect("/auth/forgot-password?error=Enter+your+email+address.");

  const appUrl = await getRequestOrigin();
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
  const tokenHash = data?.properties?.hashed_token;

  // Keep the response generic when the address does not belong to a staff account.
  if (!error && data?.user && tokenHash) {
    const resetUrl = new URL("/auth/callback", appUrl);
    resetUrl.searchParams.set("token_hash", tokenHash);
    resetUrl.searchParams.set("type", "recovery");
    resetUrl.searchParams.set("next", "/auth/update-password");
    try {
      await sendPasswordResetEmail({
        to: email,
        resetUrl: resetUrl.toString(),
        idempotencyKey: `auth/recovery/${data.user.id}/${tokenHash.slice(0, 16)}`,
      });
    } catch {
      redirect("/auth/forgot-password?error=The+recovery+email+could+not+be+sent.");
    }
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
  if (context === "invite") {
    await supabase.auth.signOut();
    redirect("/auth/sign-in?invite=complete");
  }
  redirect("/");
}
