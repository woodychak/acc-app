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
import { CurrencyManagement } from "@/components/CurrencyManagement";

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

  // Fetch company profile for the current user - get first one if multiple exist
  let { data, error } = await supabase
    .from("company_profile")
    .select("*")
    .eq("user_id", user.id)
    .limit(1);

  // Take the first result if data is an array
  const companyProfile = Array.isArray(data) ? data[0] : data;

  // Fetch currencies for the current user
  const { data: currencies } = await supabase
    .from("currencies")
    .select("*")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("code", { ascending: true });

  // Only create a new profile if none exists (not on query errors)
  if (!companyProfile && !error) {
    console.log("No company profile found, creating one now...");

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
      })
      .select()
      .single();

    if (createError) {
      console.error("Error creating company profile:", createError);
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

    revalidatePath("/dashboard/company-profile");
    return redirect("/dashboard/company-profile");
  }

  // Handle query errors
  if (error) {
    console.error("Error fetching company profile:", error);
    return (
      <div className="p-8 bg-red-50 border border-red-200 rounded-md">
        <h2 className="text-xl font-bold text-red-700 mb-2">
          Error Loading Company Profile
        </h2>
        <p className="text-red-600">{error.message}</p>
        <p className="mt-4">
          Please try refreshing the page or contact support if the issue
          persists.
        </p>
      </div>
    );
  }

  if (!companyProfile) {
    return <p className="p-8">Unable to load company profile.</p>;
  }

  const logoSrc =
    companyProfile.logo_url ||
    `https://api.dicebear.com/7.x/initials/png?seed=${encodeURIComponent(
      companyProfile.name || "Company",
    )}`;

  return (
    <>
      <DashboardNavbar />
      <main className="w-full">
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold mb-4">Company Profile</h1>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <CompanyProfileForm data={companyProfile} isSetup={isSetup} />
            <CurrencyManagement currencies={currencies || []} />
          </div>
        </div>
      </main>
    </>
  );
}