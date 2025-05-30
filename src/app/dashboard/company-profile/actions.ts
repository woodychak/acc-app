"use server";

import { createClient } from "../../../supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CompanyProfile } from "@/app/types";

export async function updateCompanyProfileAction(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  const id = formData.get("id") as string;
  const name = (formData.get("name") as string) || "";
  const tel = (formData.get("tel") as string) || "";
  const address = (formData.get("address") as string) || "";
  const contact = (formData.get("contact") as string) || "";
  const payment_terms = (formData.get("payment_terms") as string) || "";
  const default_currency =
    (formData.get("default_currency") as string) || "HKD";
  const prefix = (formData.get("prefix") as string) || "INV-";
  const bank_account = (formData.get("bank_account") as string) || "";
  const logo_url = (formData.get("logo_url") as string) || "";
  const isSetup = formData.get("setup") === "required";

  // If only logo_url is set and all other fields are empty or missing, update only logo_url
  const isLogoUrlOnlyUpdate =
    logo_url !== "" &&
    name === "" &&
    tel === "" &&
    address === "" &&
    contact === "" &&
    payment_terms === "" &&
    bank_account === "";

  if (isLogoUrlOnlyUpdate) {
    const { error } = await supabase
      .from("company_profile")
      .update({ logo_url })
      .eq("id", id);

    if (error) {
      console.error("Update logo URL failed:", error.message);
    }

    revalidatePath("/dashboard/company-profile");
    return;
  }

  // Update all fields (including logo_url if present)
  const updateData = {
    name,
    tel,
    address,
    contact,
    payment_terms,
    default_currency,
    prefix,
    bank_account,
    logo_url: logo_url || undefined,
  };

 

  const { error } = await supabase
    .from("company_profile")
    .update(updateData)
    .eq("id", id);

  if (error) {
    console.error("Update company profile failed:", error.message);
  }

  revalidatePath("/dashboard/company-profile");

  // If this was the initial setup and profile is now complete, redirect to dashboard
  if (isSetup && name && address) {
    return redirect("/dashboard");
  }
}

export async function uploadCompanyLogoAction(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.error("User not signed in.");
    return redirect("/sign-in");
  }

  const file = formData.get("logo") as File;

  if (!file || file.size === 0) {
    console.error("No file uploaded or file is empty.");
    return;
  }

  const bucketName = "company-assets"; // ✅ your target bucket

  try {
    // ✅ Ensure bucket exists
    // Ensure bucket exists
const { data: buckets } = await supabase.storage.listBuckets();

if (buckets) {
  if (!buckets.find((bucket) => bucket.name === bucketName)) {
    const { error: createBucketError } = await supabase.storage.createBucket(
      bucketName,
      { public: true },
    );
    // Handle createBucketError if needed
  }
} else {
  // Handle the case where buckets is null
  console.error('Failed to list buckets');
  // You might want to throw an error or handle this case appropriately
}

    // ✅ Generate a safe filename
    const filename = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

    // ✅ Upload the file
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filename, file, {
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      console.error("Error uploading file:", uploadError.message);
      return;
    }

    // ✅ Get public URL
    const { data: publicUrlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(uploadData.path);

      const publicUrl = publicUrlData?.publicUrl;

      if (!publicUrl) {
        console.error("Failed to get public URL");
        return;
      }

    // ✅ Get the existing company profile
    const { data: companyProfile, error: profileError } = await supabase
      .from("company_profile")
      .select("id")
      .limit(1)
      .single();

      if (profileError || !companyProfile) {
        console.error("Error fetching company profile:", profileError?.message || "No profile found");
        return;
      }

  
    
    const { error: updateError } = await supabase
      .from("company_profile")
      .update({ logo_url: publicUrlData.publicUrl })
      .eq("id", companyProfile.id);

    if (updateError) {
      console.error("Error updating logo URL:", updateError.message);
      return;
    }

    // ✅ Refresh page cache
    revalidatePath("/dashboard/company-profile");
  } catch (err) {
    console.error("Unexpected error in uploadCompanyLogoAction:", err);
  }
}
