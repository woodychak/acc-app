"use server";

import { createClient } from "../../../supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createProductAction(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const sku = formData.get("sku") as string;
  const price = parseFloat(formData.get("price") as string);
  const currency_code = formData.get("currency") as string;
  const tax_rate = formData.get("tax_rate")
    ? parseFloat(formData.get("tax_rate") as string)
    : null;
  const is_active = formData.get("is_active") === "true";

  const { error } = await supabase.from("products").insert({
    name,
    description,
    sku,
    price,
    currency_code,
    tax_rate,
    is_active,
    user_id: user.id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Error creating product:", error);
    throw new Error("Failed to create product");
  }

  revalidatePath("/dashboard/products");
  redirect("/dashboard/products");
}

export async function updateProductAction(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const sku = formData.get("sku") as string;
  const price = parseFloat(formData.get("price") as string);
  const currency_code = formData.get("currency") as string;
  const tax_rate = formData.get("tax_rate")
    ? parseFloat(formData.get("tax_rate") as string)
    : null;
  const is_active = formData.get("is_active") === "true";

  const { error } = await supabase
    .from("products")
    .update({
      name,
      description,
      sku,
      price,
      currency_code,
      tax_rate,
      is_active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("Error updating product:", error);
    throw new Error("Failed to update product");
  }

  revalidatePath("/dashboard/products");
  redirect("/dashboard/products");
}

export async function deleteProductAction(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  const id = formData.get("id") as string;

  // First check if the product is used in any invoice items
  const { data: invoiceItems } = await supabase
    .from("invoice_items")
    .select("id")
    .eq("product_id", id)
    .limit(1);

  if (invoiceItems && invoiceItems.length > 0) {
    return {
      success: false,
      message: "Cannot delete product that is used in invoices",
    };
  }

  const { error } = await supabase.from("products").delete().eq("id", id);

  if (error) {
    console.error("Error deleting product:", error);
    return { success: false, message: "Failed to delete product" };
  }

  revalidatePath("/dashboard/products");
  return { success: true };
}
