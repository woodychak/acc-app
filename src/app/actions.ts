"use server";

import { encodedRedirect } from "@/utils/utils";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "../../supabase/server";


// Function to check if any users exist and create a default admin if none exis

export const signUpAction = async (formData: FormData) => {
  const email = formData.get("email")?.toString();
  const password = formData.get("password")?.toString();
  const fullName = formData.get("full_name")?.toString() || "";
  const companyName = formData.get("company_name")?.toString() || "";
  const supabase = await createServerSupabaseClient();
  const origin = headers().get("origin");

  if (!email || !password) {
    return encodedRedirect("error", "/sign-up", "Email and password are required");
  }

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
        data: {
          full_name: fullName,
          email,
          company_name: companyName,
        },
      },
    });

    if (error) {
      console.error(error.code + " " + error.message);
      return encodedRedirect("error", "/sign-up", error.message);
    }

    if (!user) {
      return encodedRedirect(
        "success",
        "/sign-in",
        "Please check your email to confirm your account before signing in."
      );
    }

    // Insert user record
    let updateError;
    try {
      const { error: insertError } = await supabase.from("users").insert({
        id: user.id,
        name: fullName,
        full_name: fullName,
        email,
        user_id: user.id,
        token_identifier: user.id,
      });
      updateError = insertError;
    } catch (err) {
      console.error("Exception inserting user record:", err);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const { error: retryError } = await supabase.from("users").insert({
        id: user.id,
        name: fullName,
        full_name: fullName,
        email,
        user_id: user.id,
        token_identifier: user.id,
      });
      updateError = retryError;
    }

    if (updateError) {
      console.error("Error updating user profile:", updateError);
    }

    // Create company profile
    let companyError;

    try {
      // Try RPC
      const { error: rpcError } = await supabase.rpc("create_company_profile", {
        p_name: companyName || fullName + "'s Company",
        p_prefix: "INV-",
        p_default_currency: "HKD",
        p_user_id: user.id,
        p_is_complete: false,
      });

      if (!rpcError) {
        console.log("Company profile created via RPC.");
        return redirect("/dashboard/company-profile?setup=required");
      }

      console.error("RPC create_company_profile failed:", rpcError);
    } catch (rpcException) {
      console.error("Exception in RPC create_company_profile:", rpcException);
    }

    // Try insert fallback
    try {
      await supabase.rpc("disable_rls_for_company_profile");
    } catch (disableErr) {
      console.error("Could not disable RLS:", disableErr);
    }

    const { error: insertCompanyError } = await supabase.from("company_profile").insert({
      name: companyName || fullName + "'s Company",
      prefix: "INV-",
      default_currency: "HKD",
      user_id: user.id,
      created_at: new Date().toISOString(),
      is_complete: false,
    });

    if (insertCompanyError) {
      console.error("Company profile insert failed:", insertCompanyError);
      companyError = insertCompanyError;
    }
  } catch (err) {
    console.error("Unexpected error during signup process:", err);
  }

  // Always redirect to company-profile setup page
  return redirect("/dashboard/company-profile?setup=required");
};

export const signInAction = async (formData: FormData) => {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const supabase = createServerSupabaseClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // 用 redirect 回登入頁，帶 error query
    redirect(`/sign-in?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/dashboard");
};

export const forgotPasswordAction = async (formData: FormData) => {
  const email = formData.get("email")?.toString();
  const supabase = await createServerSupabaseClient();
  const origin = headers().get("origin");
  const callbackUrl = formData.get("callbackUrl")?.toString();

  if (!email) {
    return encodedRedirect("error", "/forgot-password", "Email is required");
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?redirect_to=/protected/reset-password`,
  });

  if (error) {
    console.error(error.message);
    return encodedRedirect(
      "error",
      "/forgot-password",
      "Could not reset password",
    );
  }

  if (callbackUrl) {
    return redirect(callbackUrl);
  }

  return encodedRedirect(
    "success",
    "/forgot-password",
    "Check your email for a link to reset your password.",
  );
};

export const resetPasswordAction = async (formData: FormData) => {
  const supabase = await createServerSupabaseClient();

  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!password || !confirmPassword) {
    encodedRedirect(
      "error",
      "/protected/reset-password",
      "Password and confirm password are required",
    );
  }

  if (password !== confirmPassword) {
    encodedRedirect(
      "error",
      "/dashboard/reset-password",
      "Passwords do not match",
    );
  }

  const { error } = await supabase.auth.updateUser({
    password: password,
  });

  if (error) {
    encodedRedirect(
      "error",
      "/dashboard/reset-password",
      "Password update failed",
    );
  }

  encodedRedirect("success", "/protected/reset-password", "Password updated");
};

export const signOutAction = async () => {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  return redirect("/sign-in");
};

export const createCustomerAction = async (formData: FormData) => {
  "use server";

  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const phone = formData.get("phone") as string;
  const tax_id = formData.get("tax_id") as string;
  const address = formData.get("address") as string;
  const city = formData.get("city") as string;
  const state = formData.get("state") as string;
  const postal_code = formData.get("postal_code") as string;
  const country = formData.get("country") as string;
  const notes = formData.get("notes") as string;

  const { error } = await supabase.from("customers").insert([
    {
      name,
      email,
      phone,
      tax_id,
      address,
      city,
      state,
      postal_code,
      country,
      notes,
      user_id: user.id, // ✅ this line is essential
      created_by: user.id,
    },
  ]);

  redirect("/dashboard/customers");
};

export const deleteCustomerAction = async (customerId: string) => {
  "use server";

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return redirect("/sign-in");

  const { error } = await supabase
    .from("customers")
    .delete()
    .eq("id", customerId)
    .eq("created_by", user.id);

  if (error) throw new Error("Failed to delete customer");
};

export const updateCustomerAction = async (formData: FormData) => {
  "use server";

  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return redirect("/sign-in");

  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;

  const { error } = await supabase
    .from("customers")
    .update({ name, email })
    .eq("id", id)
    .eq("created_by", user.id);

  if (error) {
    throw new Error(error.message);
  }

  redirect("/dashboard/customers");
};

export const updateCompanyProfileAction = async (formData: FormData) => {
  "use server";

  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const tel = formData.get("tel") as string;
  const address = formData.get("address") as string;
  const contact = formData.get("contact") as string;
  const prefix = formData.get("prefix") as string;
  const default_currency = formData.get("default_currency") as string;
  const payment_terms = formData.get("payment_terms") as string;
  const bank_account = formData.get("bank_account") as string;
  const logo_url = formData.get("logo_url") as string;
  const setup = formData.get("setup") as string;

  // Update company profile
  const { error } = await supabase
    .from("company_profile")
    .update({
      name,
      tel,
      address,
      contact,
      prefix,
      default_currency,
      payment_terms,
      bank_account,
      logo_url: logo_url || undefined,
      is_complete: true, // Mark as complete when user saves profile
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Error updating company profile:", error);
    throw new Error(error.message);
  }

  // If this was part of the initial setup, redirect to dashboard
  if (setup === "required") {
    return redirect("/dashboard");
  }

  // Otherwise stay on the company profile page
  return redirect("/dashboard/company-profile");
};
