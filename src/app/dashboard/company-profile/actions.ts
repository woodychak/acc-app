"use server";

import { createServerSupabaseClient } from "../../../../supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CompanyProfile } from "@/app/types";

export async function updateCompanyProfileAction(
  prevState: any,
  formData: FormData,
): Promise<{ type: "success" | "error"; message: string } | undefined> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  const id = formData.get("id") as string;
  if (!id) {
    console.error("No company profile id provided");
    return { type: "error", message: "Company profile ID is missing" };
  }

  // 取出欄位，若沒提供就為 null
  const name = formData.get("name");
  const tel = formData.get("tel");
  const address = formData.get("address");
  const contact = formData.get("contact");
  const payment_terms = formData.get("payment_terms");
  const default_currency = formData.get("default_currency");
  const prefix = formData.get("prefix");
  const bank_account = formData.get("bank_account");
  const logo_url = formData.get("logo_url");
  const smtp_host = formData.get("smtp_host");
  const smtp_port = formData.get("smtp_port");
  const smtp_username = formData.get("smtp_username");
  const smtp_password = formData.get("smtp_password");
  const email_template = formData.get("email_template");
  const isSetup = formData.get("setup") === "required";

  // 動態構造更新資料
  const updateData = {
    name: formData.get("name") as string,
    tel: formData.get("tel") as string,
    address: formData.get("address") as string,
    contact: formData.get("contact") as string,
    payment_terms: formData.get("payment_terms") as string,
    default_currency: formData.get("default_currency") as string,
    prefix: formData.get("prefix") as string,
    bank_account: formData.get("bank_account") as string,
    logo_url: formData.get("logo_url") as string,
    smtp_host: formData.get("smtp_host") as string,
    smtp_port: parseInt(formData.get("smtp_port") as string) || 587,
    smtp_username: formData.get("smtp_username") as string,
    smtp_password: formData.get("smtp_password") as string,
    smtp_secure: formData.get("smtp_secure") as string,
    smtp_sender: formData.get("smtp_sender") as string,
    email_template: formData.get("email_template") as string,
    quotation_email_template: formData.get("quotation_email_template") as string,
  };

  // Handle new SMTP fields - only if they exist in the form
  const smtp_secure = formData.get("smtp_secure");
  const smtp_sender = formData.get("smtp_sender");

  if (smtp_secure !== null) {
    updateData.smtp_secure =
      smtp_secure && smtp_secure.toString().trim() !== ""
        ? smtp_secure.toString()
        : null;
  }
  if (smtp_sender !== null) {
    updateData.smtp_sender =
      smtp_sender && smtp_sender.toString().trim() !== ""
        ? smtp_sender.toString()
        : null;
  }

  // Updated validation: Only require Company Name, Tel, and Contact Info for completion
  updateData.is_complete =
    (updateData.name?.trim() || "") !== "" &&
    (updateData.tel?.trim() || "") !== "" &&
    (updateData.contact?.trim() || "") !== "";

  try {
    const { error } = await supabase
      .from("company_profile")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Update company profile failed:", error.message);
      return { type: "error", message: `Failed to save company profile: ${error.message}` };
    }

    // Ensure default currencies exist for the user
    await ensureDefaultCurrencies(supabase, user.id);

    revalidatePath("/dashboard/company-profile");

    if (isSetup && updateData.is_complete) {
      return redirect("/dashboard");
    }
    return { type: "success", message: "公司資料已成功更新。" };
  } catch (err) {
    console.error("Unexpected error:", err);
    return { type: "error", message: "An unexpected error occurred while saving" };
  }
}

// Helper function to ensure default currencies exist for a user
async function ensureDefaultCurrencies(supabase: any, userId: string) {
  const defaultCurrencies = [
    { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', is_default: true },
    { code: 'USD', name: 'US Dollar', symbol: '$', is_default: false },
    { code: 'EUR', name: 'Euro', symbol: '€', is_default: false },
    { code: 'GBP', name: 'British Pound', symbol: '£', is_default: false },
    { code: 'JPY', name: 'Japanese Yen', symbol: '¥', is_default: false },
    { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', is_default: false },
    { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', is_default: false },
    { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', is_default: false },
    { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', is_default: false }
  ];

  for (const currency of defaultCurrencies) {
    await supabase
      .from('currencies')
      .upsert({
        user_id: userId,
        code: currency.code,
        name: currency.name,
        symbol: currency.symbol,
        is_default: currency.is_default,
        is_active: true
      }, {
        onConflict: 'user_id,code',
        ignoreDuplicates: true
      });
  }
}

export async function addCurrencyAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  const code = formData.get("code") as string;
  const name = formData.get("name") as string;
  const symbol = formData.get("symbol") as string;

  if (!code || !name || !symbol) {
    return { type: "error", message: "All fields are required" };
  }

  try {
    const { error } = await supabase
      .from("currencies")
      .insert({
        user_id: user.id,
        code: code.toUpperCase().trim(),
        name: name.trim(),
        symbol: symbol.trim(),
        is_default: false,
        is_active: true,
      });

    if (error) {
      console.error("Currency insert error:", error);
      if (error.code === "23505") {
        return { type: "error", message: "Currency already exists in your profile" };
      }
      return { type: "error", message: `Failed to add currency: ${error.message}` };
    }

    revalidatePath("/dashboard/company-profile");
    return { type: "success", message: "Currency added successfully" };
  } catch (err) {
    console.error("Unexpected error:", err);
    return { type: "error", message: "An unexpected error occurred" };
  }
}

export async function removeCurrencyAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  const currencyId = formData.get("currencyId") as string;

  if (!currencyId) {
    return { type: "error", message: "Currency ID is required" };
  }

  // Check if it's the default currency
  const { data: currency } = await supabase
    .from("currencies")
    .select("is_default")
    .eq("id", currencyId)
    .eq("user_id", user.id)
    .single();

  if (currency?.is_default) {
    return { type: "error", message: "Cannot remove default currency" };
  }

  const { error } = await supabase
    .from("currencies")
    .delete()
    .eq("id", currencyId)
    .eq("user_id", user.id);

  if (error) {
    return { type: "error", message: "Failed to remove currency" };
  }

  revalidatePath("/dashboard/company-profile");
  return { type: "success", message: "Currency removed successfully" };
}

export async function setDefaultCurrencyAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  const currencyId = formData.get("currencyId") as string;

  if (!currencyId) {
    return { type: "error", message: "Currency ID is required" };
  }

  const { error } = await supabase
    .from("currencies")
    .update({ is_default: true })
    .eq("id", currencyId)
    .eq("user_id", user.id);

  if (error) {
    return { type: "error", message: "Failed to set default currency" };
  }

  revalidatePath("/dashboard/company-profile");
  return { type: "success", message: "Default currency updated" };
}

export async function uploadCompanyLogoAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();

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

  const bucketName = "company-assets";

  try {
    // 確保 bucket 存在
    const { data: buckets } = await supabase.storage.listBuckets();
    if (buckets && !buckets.find((bucket) => bucket.name === bucketName)) {
      const { error: createBucketError } = await supabase.storage.createBucket(
        bucketName,
        {
          public: true,
        },
      );
      if (createBucketError) {
        console.error("Create bucket error:", createBucketError.message);
        return;
      }
    }

    // 安全檔名
    const filename = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

    // 上傳檔案
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

    // 取得公開 URL
    const { data: publicUrlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(uploadData.path);

    const publicUrl = publicUrlData?.publicUrl;
    if (!publicUrl) {
      console.error("Failed to get public URL");
      return;
    }

    // 更新 logo_url - FIXED: Add user_id filter to prevent updating wrong profile
    const { error: updateError } = await supabase
      .from("company_profile")
      .update({ logo_url: publicUrl })
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Error updating logo URL:", updateError.message);
      return;
    }

    revalidatePath("/dashboard/company-profile");
  } catch (err) {
    console.error("Unexpected error in uploadCompanyLogoAction:", err);
  }
}