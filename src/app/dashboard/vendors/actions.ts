"use server";

import { createServerSupabaseClient } from "../../../../supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createVendorAction(formData: FormData) {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const phone = formData.get("phone") as string;
  const address = formData.get("address") as string;
  const city = formData.get("city") as string;
  const state = formData.get("state") as string;
  const postal_code = formData.get("postal_code") as string;
  const country = formData.get("country") as string;
  const tax_id = formData.get("tax_id") as string;
  const contact_person = formData.get("contact_person") as string;
  const notes = formData.get("notes") as string;

  const { error } = await supabase.from("vendors").insert({
    name,
    email: email || null,
    phone: phone || null,
    address: address || null,
    city: city || null,
    state: state || null,
    postal_code: postal_code || null,
    country: country || null,
    tax_id: tax_id || null,
    contact_person: contact_person || null,
    notes: notes || null,
    is_active: true,
    user_id: user.id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Error creating vendor:", error);
    throw new Error("Failed to create vendor");
  }

  revalidatePath("/dashboard/vendors");
  redirect("/dashboard/vendors");
}

export async function updateVendorAction(formData: FormData) {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const phone = formData.get("phone") as string;
  const address = formData.get("address") as string;
  const city = formData.get("city") as string;
  const state = formData.get("state") as string;
  const postal_code = formData.get("postal_code") as string;
  const country = formData.get("country") as string;
  const tax_id = formData.get("tax_id") as string;
  const contact_person = formData.get("contact_person") as string;
  const notes = formData.get("notes") as string;
  const is_active = formData.get("is_active") === "true";

  const { error } = await supabase
    .from("vendors")
    .update({
      name,
      email: email || null,
      phone: phone || null,
      address: address || null,
      city: city || null,
      state: state || null,
      postal_code: postal_code || null,
      country: country || null,
      tax_id: tax_id || null,
      contact_person: contact_person || null,
      notes: notes || null,
      is_active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("Error updating vendor:", error);
    throw new Error("Failed to update vendor");
  }

  revalidatePath("/dashboard/vendors");
  redirect("/dashboard/vendors");
}

export async function deleteVendorAction(id: string) {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Unauthorized" };
  }

  // Check if vendor is used in any products
  const { data: products } = await supabase
    .from("products")
    .select("id")
    .eq("vendor_id", id)
    .limit(1);

  if (products && products.length > 0) {
    return {
      success: false,
      message: "Cannot delete vendor that is linked to products. Please remove vendor from products first.",
    };
  }

  // Check if vendor is used in any purchase orders
  const { data: pos } = await supabase
    .from("purchase_orders")
    .select("id")
    .eq("vendor_id", id)
    .limit(1);

  if (pos && pos.length > 0) {
    return {
      success: false,
      message: "Cannot delete vendor that has purchase orders.",
    };
  }

  const { error } = await supabase.from("vendors").delete().eq("id", id);

  if (error) {
    console.error("Error deleting vendor:", error);
    return { success: false, message: "Failed to delete vendor" };
  }

  revalidatePath("/dashboard/vendors");
  return { success: true };
}
