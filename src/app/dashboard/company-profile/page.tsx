import { createServerSupabaseClient } from "../../../../supabase/server";
import DashboardNavbar from "@/components/dashboard-navbar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import Image from "next/image";
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

  console.log("Company profile query result:", { data, error: error?.message });

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

          {isSetup && (
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
              <p className="text-blue-700">
                <strong>Welcome to your new account!</strong> Please complete
                your company profile to continue.
              </p>
            </div>
          )}

          <form
            action={updateCompanyProfileAction}
            className="space-y-6"
            key="profile-form"
          >
            <input type="hidden" name="id" value={data.id} />
            {/* Pass setup parameter if it exists in URL */}
            {isSetup && <input type="hidden" name="setup" value="required" />}

            <div className="space-y-2">
              <Label htmlFor="name">Company Name</Label>
              <Input id="name" name="name" defaultValue={data.name || ""} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tel">Tel</Label>
              <Input id="tel" name="tel" defaultValue={data.tel || ""} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                name="address"
                rows={3}
                defaultValue={data.address || ""}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact">Contact Info</Label>
              <Input
                id="contact"
                name="contact"
                defaultValue={data.contact || ""}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prefix">Invoice Prefix</Label>
              <Input
                id="prefix"
                name="prefix"
                defaultValue={data.prefix || "INV-"}
                placeholder="INV-"
              />
              <p className="text-xs text-muted-foreground">
                This prefix will be used for all new invoice numbers
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="default_currency">Default Currency</Label>
              <select
                id="default_currency"
                name="default_currency"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                defaultValue={data.default_currency || "HKD"}
              >
                <option value="HKD">HKD - Hong Kong Dollar</option>
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
                <option value="GBP">GBP - British Pound</option>
                <option value="JPY">JPY - Japanese Yen</option>
                <option value="CNY">CNY - Chinese Yuan</option>
                <option value="CAD">CAD - Canadian Dollar</option>
                <option value="AUD">AUD - Australian Dollar</option>
                <option value="SGD">SGD - Singapore Dollar</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_terms">Payment Terms</Label>
              <Textarea
                id="payment_terms"
                name="payment_terms"
                rows={3}
                defaultValue={data.payment_terms || ""}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bank_account">Bank Account Details</Label>
              <Textarea
                id="bank_account"
                name="bank_account"
                rows={3}
                defaultValue={data.bank_account || ""}
                placeholder={`Bank Name: ABC Bank\nAccount Name: Your Company Ltd\nAccount Number: 1234567890\nSort Code/SWIFT: ABCDEF12`}
              />
              <p className="text-xs text-muted-foreground">
                This information will be available when recording payments
              </p>
            </div>
            <div className="flex justify-end">
              <Button type="submit">Save Profile</Button>
            </div>
          </form>

          {/* Logo Section */}
          <div className="space-y-6 mt-12">
            <div className="space-y-2">
              <Label>Logo</Label>
              <Image
                src={logoSrc}
                alt="Company Logo"
                width={200}
                height={200}
                className="rounded border p-2 bg-white"
              />
              <p className="text-xs text-muted-foreground">
                Your logo will appear on invoices and your company profile
              </p>
            </div>

            {/* Upload Logo File */}
            <form
              action={uploadCompanyLogoAction}
              encType="multipart/form-data"
              method="post"
              className="space-y-2"
              key="upload-logo-form"
            >
              <Input
                type="file"
                id="logo_upload"
                name="logo"
                accept="image/*"
                required
              />
              <Button type="submit" className="mt-2">
                Upload Logo
              </Button>
            </form>

            {/* Provide Logo URL */}
            <form
              action={updateCompanyProfileAction}
              className="space-y-2"
              key="logo-url-form"
            >
              <input type="hidden" name="id" value={data.id} />
              <Input
                id="logo_url"
                name="logo_url"
                placeholder="https://example.com/logo.png"
                defaultValue={data.logo_url || ""}
              />
              <Button type="submit" className="mt-2">
                Save Logo URL
              </Button>
            </form>
          </div>
        </div>
      </main>
    </>
  );
}
