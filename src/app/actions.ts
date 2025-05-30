"use server";

import { encodedRedirect } from "@/utils/utils";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "../supabase/server";

// Function to check if any users exist and create a default admin if none exist
export const createDefaultAdminIfNeeded = async () => {
  // This function is now a no-op - we no longer create a default admin user
  // Each user will have their own company profile with proper data isolation
  console.log("Default admin creation is disabled");
  return;
};

export const signUpAction = async (formData: FormData) => {
  const email = formData.get("email")?.toString();
  const password = formData.get("password")?.toString();
  const fullName = formData.get("full_name")?.toString() || "";
  const companyName = formData.get("company_name")?.toString() || "";
  const supabase = await createClient();
  const origin = headers().get("origin");

  if (!email || !password) {
    return encodedRedirect(
      "error",
      "/sign-up",
      "Email and password are required",
    );
  }

  // Use admin client to bypass RLS for initial user creation
  const serviceClient = await createClient({ admin: true });

  const {
    data: { user },
    error,
  } = await serviceClient.auth.signUp({
    email,
    password,
    options: {
      // No email confirmation needed
      emailRedirectTo: `${origin}/auth/callback`,
      data: {
        full_name: fullName,
        email: email,
        company_name: companyName,
      },
    },
  });

  if (error) {
    console.error(error.code + " " + error.message);
    return encodedRedirect("error", "/sign-up", error.message);
  }

  if (user) {
    try {
      // Automatically confirm the user's email - using a direct approach
      try {
        const { error: confirmError } =
          await serviceClient.auth.admin.updateUserById(user.id, {
            email_confirm: true,
          });

        if (confirmError) {
          console.error("Error confirming user email:", confirmError);
          // Fallback to RPC method if admin API fails
          try {
            const { error: rpcError } = await serviceClient.rpc(
              "confirm_user",
              {
                user_id: user.id,
              },
            );

            if (rpcError) {
              console.error("Error confirming user email with RPC:", rpcError);
            }
          } catch (rpcErr) {
            console.error("Exception in RPC confirm_user:", rpcErr);
          }
        }
      } catch (confirmErr) {
        console.error("Exception in email confirmation:", confirmErr);
      }

      // Insert user record - retry if it fails
      let updateError;
      try {
        const { error: insertError } = await serviceClient
          .from("users")
          .insert({
            id: user.id,
            name: fullName,
            full_name: fullName,
            email: email,
            user_id: user.id,
            token_identifier: user.id,
          });
        updateError = insertError;
      } catch (err) {
        console.error("Exception inserting user record:", err);
        // Try again with a delay
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const { error: retryError } = await serviceClient.from("users").insert({
          id: user.id,
          name: fullName,
          full_name: fullName,
          email: email,
          user_id: user.id,
          token_identifier: user.id,
        });
        updateError = retryError;
      }

      if (updateError) {
        console.error("Error updating user profile:", updateError);
      }

      // Create company profile for this specific user - using multiple approaches
      let companyError;
      try {
        // First try using the direct RPC function that bypasses RLS
        try {
          const { error: rpcError } = await serviceClient.rpc(
            "create_company_profile",
            {
              p_name: companyName || fullName + "'s Company",
              p_prefix: "INV-",
              p_default_currency: "HKD",
              p_user_id: user.id,
              p_is_complete: false,
            },
          );

          if (rpcError) {
            console.error(
              "Failed to create company profile via RPC:",
              rpcError,
            );
            // Fall through to next approach
          } else {
            // Success! No need to try other approaches
            console.log(
              "Successfully created company profile via RPC function",
            );
            companyError = null;
            return redirect("/dashboard/company-profile?setup=required");
          }
        } catch (rpcErr) {
          console.error("Exception in create_company_profile RPC:", rpcErr);
          // Continue to next approach
        }

        // Second approach: Try to disable RLS first
        try {
          await serviceClient.rpc("disable_rls_for_company_profile");
          console.log("RLS temporarily disabled for company profile creation");
        } catch (rpcErr) {
          console.error("Failed to disable RLS:", rpcErr);
          // Continue anyway, the insert might still work
        }

        // Now try the insert
        const { error: insertError } = await serviceClient
          .from("company_profile")
          .insert({
            name: companyName || fullName + "'s Company",
            prefix: "INV-",
            default_currency: "HKD",
            user_id: user.id, // Link company profile to this specific user
            created_at: new Date().toISOString(),
            is_complete: false, // Mark as incomplete to force profile completion on first login
          });

        if (insertError) {
          console.error("Failed to insert company profile:", insertError);
          companyError = insertError;
        } else {
          console.log("Successfully created company profile via insert");
          companyError = null;
        }
      } catch (err) {
        console.error("Exception creating company profile:", err);
        // Try again with a delay
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Try one more time with explicit RLS disable
        try {
          await serviceClient.rpc("disable_rls_for_company_profile");
          console.log("RLS temporarily disabled on retry");
        } catch (rpcErr) {
          console.error("Failed to disable RLS on retry:", rpcErr);
        }

        const { error: retryError } = await serviceClient
          .from("company_profile")
          .insert({
            name: companyName || fullName + "'s Company",
            prefix: "INV-",
            default_currency: "HKD",
            user_id: user.id,
            created_at: new Date().toISOString(),
            is_complete: false,
          });
        companyError = retryError;
      }

      if (companyError) {
        console.error("Error creating company profile:", companyError);
      }
    } catch (err) {
      console.error("Error in user profile creation:", err);
    }
  }

  // Redirect to dashboard/company-profile since email is already confirmed
  // This ensures the user completes their profile on first login
  return redirect("/dashboard/company-profile?setup=required");
};

export const signInAction = async (formData: FormData) => {
  // Check if we need to create a default admin user
  await createDefaultAdminIfNeeded();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return encodedRedirect("error", "/sign-in", error.message);
  }

  return redirect("/dashboard");
};

export const forgotPasswordAction = async (formData: FormData) => {
  const email = formData.get("email")?.toString();
  const supabase = await createClient();
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
  const supabase = await createClient();

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
  const supabase = await createClient();
  await supabase.auth.signOut();
  return redirect("/sign-in");
};

export const createCustomerAction = async (formData: FormData) => {
  "use server";

  const supabase = await createClient();

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
    },
  ]);

  if (error) {
    console.error("Customer insert error:", error.message);
    throw new Error(error.message); // This will be caught by Next.js error boundary
  }

  redirect("/dashboard/customers");
};

export const deleteCustomerAction = async (customerId: string) => {
  "use server";

  const supabase = await createClient();
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

  const supabase = await createClient();

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

  const supabase = await createClient();

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
