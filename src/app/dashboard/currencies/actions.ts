"use server";

import { createServerSupabaseClient } from "../../../../supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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

    revalidatePath("/dashboard/currencies");
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

  revalidatePath("/dashboard/currencies");
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

  // First, unset all default currencies for this user
  await supabase
    .from("currencies")
    .update({ is_default: false })
    .eq("user_id", user.id);

  // Then set the selected currency as default
  const { error } = await supabase
    .from("currencies")
    .update({ is_default: true })
    .eq("id", currencyId)
    .eq("user_id", user.id);

  if (error) {
    return { type: "error", message: "Failed to set default currency" };
  }

  revalidatePath("/dashboard/currencies");
  return { type: "success", message: "Default currency updated" };
}