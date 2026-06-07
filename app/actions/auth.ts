"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signupSchema, loginSchema } from "@/lib/validations/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { headers } from "next/headers";

export async function login(formData: FormData) {
  const supabase = await createClient();

  // Server-side validation
  const data = Object.fromEntries(formData.entries());
  const result = loginSchema.safeParse(data);

  if (!result.success) {
    const error = result.error.issues[0]?.message || "VALIDATION_FAILED";
    return { error };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: result.data.email,
    password: result.data.password,
  });

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect("/events");
}

export async function signup(formData: FormData) {
  const supabase = await createClient();

  // Server-side validation
  const data = Object.fromEntries(formData.entries());
  const result = signupSchema.safeParse(data);

  if (!result.success) {
    const error = result.error.issues[0]?.message || "VALIDATION_FAILED";
    return { error };
  }

  const { error } = await supabase.auth.signUp({
    email: result.data.email,
    password: result.data.password,
  });

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect("/events");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function deleteAccountAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);

  if (error) {
    return { error: error.message };
  }

  // Clear session on client/cookies
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function sendPasswordResetEmailAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return { error: "Not authenticated" };
  }

  const headersList = await headers();
  const host = headersList.get("host");
  const protocol = headersList.get("x-forwarded-proto") ?? "http";
  const origin = `${protocol}://${host}`;

  const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
    redirectTo: `${origin}/auth/callback?next=/settings/account`,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
