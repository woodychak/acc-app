import { createServerSupabaseClient } from "../../../../supabase/server";
import { useState } from "react";
import DashboardNavbar from "@/components/dashboard-navbar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import Image from "next/image";
import { CompanyProfileForm } from "@/components/CompanyProfileForm";
import { FormMessage, Message } from "@/components/form-message";
import { useFormState } from "react-dom";
import { uploadCompanyLogoAction, updateCompanyProfileAction } from "./actions";

export default async function CompanyProfilePage() {
  // Check if this is the initial setup
  const headerUrl = headers().get("x-url") || "";
  let isSetup = false;
  try {
    if (headerUrl) {
      isSetup = new URL(headerUrl).searchParams.get("setup") === "required";
    }
  } catch (e) {
    console.error("Invalid URL in headers:", e);
  }
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  // Fetch company profile for the current user
  let { data, error } = await supabase
    .from("company_profile")
    .select("*")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  // If none exists, create an empty profile for this user and reload
  if (error || !data) {
    console.log("No company profile found, creating one now...");

    // First try to disable RLS for this operation
    try {
      try {
        await supabase.rpc("disable_rls_for_company_profile");
        console.log("Successfully disabled RLS for company profile creation");
      } catch (rpcErr) {
        console.error("Failed to disable RLS via RPC:", rpcErr);
        // Continue anyway, the insert might still work with admin client
      }

      const { data: newProfile, error: createError } = await supabase
        .from("company_profile")
        .insert({
          name: "",
          prefix: "INV-",
          default_currency: "HKD",
          user_id: user.id,
          is_complete: false,
          smtp_host: null,
          smtp_port: null,
          smtp_username: null,
          smtp_password: null,
          email_template: null,
        });

      if (createError) {
        console.error("Error creating company profile:", createError);

        // If still getting RLS error, try a more direct approach
        if (
          createError.code === "42501" ||
          createError.message.includes("violates row-level security policy")
        ) {
          try {
            // Try direct SQL execution if available
            const { error: sqlError } = await supabase.rpc("execute_sql", {
              sql_query: `INSERT INTO company_profile (name, prefix, default_currency, user_id, is_complete) 
                           VALUES ('', 'INV-', 'HKD', '${user.id}', false)`,
            });

            if (sqlError) {
              console.error("SQL execution error:", sqlError);
              return (
                <div className="p-8 bg-red-50 border border-red-200 rounded-md">
                  <h2 className="text-xl font-bold text-red-700 mb-2">
                    Error Creating Company Profile
                  </h2>
                  <p className="text-red-600">{sqlError.message}</p>
                  <p className="mt-4">
                    Please try refreshing the page or contact support if the
                    issue persists.
                  </p>
                </div>
              );
            }
          } catch (sqlErr) {
            console.error("Exception in SQL execution:", sqlErr);

            try {
              await new Promise((resolve) => setTimeout(resolve, 1000));
              const { error: finalError } = await supabase
                .from("company_profile")
                .insert({
                  name: "",
                  prefix: "INV-",
                  default_currency: "HKD",
                  user_id: user.id,
                  is_complete: false,
                });

              if (finalError) {
                console.error("Final attempt error:", finalError);
                return (
                  <div className="p-8 bg-red-50 border border-red-200 rounded-md">
                    <h2 className="text-xl font-bold text-red-700 mb-2">
                      Error Creating Company Profile
                    </h2>
                    <p className="text-red-600">{finalError.message}</p>
                    <p className="mt-4">
                      Please try refreshing the page or contact support if the
                      issue persists.
                    </p>
                  </div>
                );
              }
            } catch (finalErr) {
              console.error("Final exception:", finalErr);
              return (
                <div className="p-8 bg-red-50 border border-red-200 rounded-md">
                  <h2 className="text-xl font-bold text-red-700 mb-2">
                    Error Creating Company Profile
                  </h2>
                  <p className="text-red-600">
                    Unable to create company profile
                  </p>
                  <p className="mt-4">
                    Please try refreshing the page or contact support if the
                    issue persists.
                  </p>
                </div>
              );
            }
          }
        } else {
          return (
            <div className="p-8 bg-red-50 border border-red-200 rounded-md">
              <h2 className="text-xl font-bold text-red-700 mb-2">
                Error Creating Company Profile
              </h2>
              <p className="text-red-600">{createError.message}</p>
              <p className="mt-4">
                Please try refreshing the page or contact support if the issue
                persists.
              </p>
            </div>
          );
        }
      }
    } catch (err) {
      console.error("Exception in company profile creation:", err);
      return (
        <div className="p-8 bg-red-50 border border-red-200 rounded-md">
          <h2 className="text-xl font-bold text-red-700 mb-2">
            Error Creating Company Profile
          </h2>
          <p className="text-red-600">An unexpected error occurred</p>
          <p className="mt-4">
            Please try refreshing the page or contact support if the issue
            persists.
          </p>
        </div>
      );
    }

    revalidatePath("/dashboard/company-profile");
    return redirect("/dashboard/company-profile");
  }

  if (!data) {
    return <p className="p-8">Unable to load company profile.</p>;
  }

  const logoSrc =
    data.logo_url ||
    `https://api.dicebear.com/7.x/initials/png?seed=${encodeURIComponent(
      data.name || "Company",
    )}`;

  return (
    <>
      <DashboardNavbar />
      <main className="w-full">
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold mb-4">Company Profile</h1>

          <CompanyProfileForm data={data} isSetup={isSetup} />
        </div>
      </main>
    </>
  );
}
