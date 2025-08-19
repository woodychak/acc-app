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
    return;
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
  const updateData: any = {};
  if (name !== null) updateData.name = name.toString();
  if (tel !== null) updateData.tel = tel.toString();
  if (address !== null) updateData.address = address.toString();
  if (contact !== null) updateData.contact = contact.toString();
  if (payment_terms !== null)
    updateData.payment_terms = payment_terms.toString();
  if (default_currency !== null)
    updateData.default_currency = default_currency.toString();
  if (prefix !== null) updateData.prefix = prefix.toString();
  if (bank_account !== null) updateData.bank_account = bank_account.toString();
  if (logo_url !== null && logo_url !== "")
    updateData.logo_url = logo_url.toString();
  // Handle SMTP settings - always update these fields, even if empty
  updateData.smtp_host =
    smtp_host && smtp_host.toString().trim() !== ""
      ? smtp_host.toString()
      : null;
  updateData.smtp_port =
    smtp_port && smtp_port.toString().trim() !== ""
      ? parseInt(smtp_port.toString(), 10) || null
      : null;
  updateData.smtp_username =
    smtp_username && smtp_username.toString().trim() !== ""
      ? smtp_username.toString()
      : null;
  updateData.smtp_password =
    smtp_password && smtp_password.toString().trim() !== ""
      ? smtp_password.toString()
      : null;
  updateData.email_template =
    email_template && email_template.toString().trim() !== ""
      ? email_template.toString()
      : null;

  // Handle new SMTP fields
  const smtp_secure = formData.get("smtp_secure");
  const smtp_sender = formData.get("smtp_sender");

  updateData.smtp_secure =
    smtp_secure && smtp_secure.toString().trim() !== ""
      ? smtp_secure.toString()
      : null;
  updateData.smtp_sender =
    smtp_sender && smtp_sender.toString().trim() !== ""
      ? smtp_sender.toString()
      : null;

  // 設定 is_complete，只根據 name + address 判斷
  updateData.is_complete =
    (updateData.name?.trim() || "") !== "" &&
    (updateData.address?.trim() || "") !== "";

  const { error } = await supabase
    .from("company_profile")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Update company profile failed:", error.message);
  }

  revalidatePath("/dashboard/company-profile");

  if (isSetup && updateData.is_complete) {
    return redirect("/dashboard");
  }
  return { type: "success", message: "公司資料已成功更新。" };
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

    // 取得公司 profile id
    const { data: companyProfile, error: profileError } = await supabase
      .from("company_profile")
      .select("id")
      .limit(1)
      .single();

    if (profileError || !companyProfile) {
      console.error(
        "Error fetching company profile:",
        profileError?.message || "No profile found",
      );
      return;
    }

    // 更新 logo_url
    const { error: updateError } = await supabase
      .from("company_profile")
      .update({ logo_url: publicUrl })
      .eq("id", companyProfile.id);

    if (updateError) {
      console.error("Error updating logo URL:", updateError.message);
      return;
    }

    revalidatePath("/dashboard/company-profile");
  } catch (err) {
    console.error("Unexpected error in uploadCompanyLogoAction:", err);
  }
}
