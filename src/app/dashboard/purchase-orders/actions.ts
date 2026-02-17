"use server";

import { createServerSupabaseClient } from "../../../../supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function createPurchaseOrderAction(formData: FormData) {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    const poNumber = formData.get("po_number") as string;
    const vendorId = formData.get("vendor_id") as string;
    const customerId = formData.get("customer_id") as string;
    const quotationId = formData.get("quotation_id") as string;
    const issueDate = formData.get("issue_date") as string;
    const expectedDate = formData.get("expected_date") as string;
    const currency = formData.get("currency_code") as string;
    const status = formData.get("status") as string;
    const notes = formData.get("notes") as string;
    const termsConditions = formData.get("terms_conditions") as string;
    const deliveryAddress = formData.get("delivery_address") as string;
    const discountAmount = Number(formData.get("discount_amount") || 0);
    const subtotal = Number(formData.get("subtotal") || 0);
    const taxAmount = Number(formData.get("tax_amount") || 0);
    const totalAmount = Number(formData.get("total_amount") || 0);

    const { data: po, error: insertError } = await supabase
      .from("purchase_orders")
      .insert({
        po_number: poNumber,
        vendor_id: vendorId,
        customer_id: customerId && customerId.trim() !== "" ? customerId : null,
        quotation_id: quotationId && quotationId.trim() !== "" ? quotationId : null,
        issue_date: issueDate,
        expected_date: expectedDate || null,
        currency_code: currency,
        status: status || "draft",
        notes: notes || null,
        terms_conditions: termsConditions || null,
        delivery_address: deliveryAddress || null,
        discount_amount: discountAmount,
        subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        user_id: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating purchase order:", insertError);
      throw new Error(`Failed to create purchase order: ${insertError.message}`);
    }

    // Save PO items
    const items: any[] = [];
    for (let i = 0; formData.has(`items[${i}][description]`); i++) {
      const quantity = Number(formData.get(`items[${i}][quantity]`));
      const unitPrice = Number(formData.get(`items[${i}][unit_price]`));
      const taxRate = Number(formData.get(`items[${i}][tax_rate]`));
      const lineTotal = quantity * unitPrice;
      const taxAmt = lineTotal * (taxRate / 100);
      const productId = formData.get(`items[${i}][product_id]`) as string;

      items.push({
        purchase_order_id: po.id,
        product_id: productId && productId.trim() !== "" ? productId : null,
        description: formData.get(`items[${i}][description]`),
        quantity,
        unit_price: unitPrice,
        tax_rate: taxRate,
        tax_amount: taxAmt,
        line_total: lineTotal,
      });
    }

    if (items.length > 0) {
      const { error: itemError } = await supabase
        .from("purchase_order_items")
        .insert(items);

      if (itemError) {
        console.error("Error creating PO items:", itemError);
        throw new Error(`Failed to create PO items: ${itemError.message}`);
      }
    }

    revalidatePath("/dashboard/purchase-orders");
    redirect(`/dashboard/purchase-orders/${po.id}`);
  } catch (error: any) {
    if (error?.digest?.startsWith("NEXT_REDIRECT")) {
      throw error;
    }
    console.error("Error in createPurchaseOrderAction:", error);
    throw error;
  }
}

export async function updatePurchaseOrderAction(formData: FormData) {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    const poId = formData.get("id") as string;
    const poNumber = formData.get("po_number") as string;
    const vendorId = formData.get("vendor_id") as string;
    const customerId = formData.get("customer_id") as string;
    const quotationId = formData.get("quotation_id") as string;
    const issueDate = formData.get("issue_date") as string;
    const expectedDate = formData.get("expected_date") as string;
    const currency = formData.get("currency_code") as string;
    const status = formData.get("status") as string;
    const notes = formData.get("notes") as string;
    const termsConditions = formData.get("terms_conditions") as string;
    const deliveryAddress = formData.get("delivery_address") as string;
    const discountAmount = Number(formData.get("discount_amount") || 0);
    const subtotal = Number(formData.get("subtotal") || 0);
    const taxAmount = Number(formData.get("tax_amount") || 0);
    const totalAmount = Number(formData.get("total_amount") || 0);

    const { error: updateError } = await supabase
      .from("purchase_orders")
      .update({
        po_number: poNumber,
        vendor_id: vendorId,
        customer_id: customerId && customerId.trim() !== "" ? customerId : null,
        quotation_id: quotationId && quotationId.trim() !== "" ? quotationId : null,
        issue_date: issueDate,
        expected_date: expectedDate || null,
        currency_code: currency,
        status: status || "draft",
        notes: notes || null,
        terms_conditions: termsConditions || null,
        delivery_address: deliveryAddress || null,
        discount_amount: discountAmount,
        subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", poId);

    if (updateError) {
      console.error("Error updating purchase order:", updateError);
      throw new Error(`Failed to update purchase order: ${updateError.message}`);
    }

    // Delete existing items
    await supabase
      .from("purchase_order_items")
      .delete()
      .eq("purchase_order_id", poId);

    // Re-insert items
    const items: any[] = [];
    for (let i = 0; formData.has(`items[${i}][description]`); i++) {
      const quantity = Number(formData.get(`items[${i}][quantity]`));
      const unitPrice = Number(formData.get(`items[${i}][unit_price]`));
      const taxRate = Number(formData.get(`items[${i}][tax_rate]`));
      const lineTotal = quantity * unitPrice;
      const taxAmt = lineTotal * (taxRate / 100);
      const productId = formData.get(`items[${i}][product_id]`) as string;

      items.push({
        purchase_order_id: poId,
        product_id: productId && productId.trim() !== "" ? productId : null,
        description: formData.get(`items[${i}][description]`),
        quantity,
        unit_price: unitPrice,
        tax_rate: taxRate,
        tax_amount: taxAmt,
        line_total: lineTotal,
      });
    }

    if (items.length > 0) {
      const { error: itemError } = await supabase
        .from("purchase_order_items")
        .insert(items);

      if (itemError) {
        console.error("Error creating PO items:", itemError);
        throw new Error(`Failed to create PO items: ${itemError.message}`);
      }
    }

    revalidatePath("/dashboard/purchase-orders");
    redirect(`/dashboard/purchase-orders/${poId}`);
  } catch (error: any) {
    if (error?.digest?.startsWith("NEXT_REDIRECT")) {
      throw error;
    }
    console.error("Error in updatePurchaseOrderAction:", error);
    throw error;
  }
}

export async function deletePurchaseOrderAction(poId: string) {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    // Delete items first
    await supabase
      .from("purchase_order_items")
      .delete()
      .eq("purchase_order_id", poId);

    const { error } = await supabase
      .from("purchase_orders")
      .delete()
      .eq("id", poId);

    if (error) {
      throw new Error(`Failed to delete purchase order: ${error.message}`);
    }

    revalidatePath("/dashboard/purchase-orders");
    return { success: true };
  } catch (error) {
    console.error("Error deleting purchase order:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}
