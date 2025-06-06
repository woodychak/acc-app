"use server";

import { createServerSupabaseClient } from "../../../../supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createInvoiceAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  try {
    // Use the invoice number from the form (which is now auto-generated)
    const invoiceNumber = formData.get("invoice_number") as string;

    const customerId = formData.get("customer_id");
    const issueDate = formData.get("issue_date");
    const dueDate = formData.get("due_date");
    const currency = formData.get("currency_code");
    const status = formData.get("status");
    const notes = formData.get("notes");
    const discountAmount = Number(formData.get("discount_amount") || 0);
    const subtotal = Number(formData.get("subtotal") || 0);
    const taxAmount = Number(formData.get("tax_amount") || 0);
    const totalAmount = Number(formData.get("total_amount") || 0);

    // First, insert the invoice
    const { data: invoice, error: insertError } = await supabase
      .from("invoices")
      .insert({
        invoice_number: invoiceNumber,
        customer_id: customerId,
        issue_date: issueDate,
        due_date: dueDate,
        currency_code: currency,
        status,
        notes,
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
      console.error("Error creating invoice:", insertError);
      throw new Error(`Failed to create invoice: ${insertError.message}`);
    }

    // Save invoice items
    const items: any[] = [];
    for (let i = 0; formData.has(`items[${i}][description]`); i++) {
      const quantity = Number(formData.get(`items[${i}][quantity]`));
      const unitPrice = Number(formData.get(`items[${i}][unit_price]`));
      const taxRate = Number(formData.get(`items[${i}][tax_rate]`));
      const lineTotal = quantity * unitPrice;
      const taxAmount = lineTotal * (taxRate / 100);
      const productId = formData.get(`items[${i}][product_id]`) as string;

      items.push({
        invoice_id: invoice.id,
        product_id: productId && productId.trim() !== "" ? productId : null,
        description: formData.get(`items[${i}][description]`),
        quantity,
        unit_price: unitPrice,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        line_total: lineTotal,
      });
    }

    if (items.length > 0) {
      const { error: itemError } = await supabase
        .from("invoice_items")
        .insert(items);

      if (itemError) {
        console.error("Error creating invoice items:", itemError);
        throw new Error(`Failed to create invoice items: ${itemError.message}`);
      }
    }

    revalidatePath("/dashboard/invoices");
    return redirect(`/dashboard/invoices/${invoice.id}`);
  } catch (error) {
    console.error("Error in createInvoiceAction:", error);
    throw error;
  }
}

export async function generateInvoicePdfAction(invoiceId: string) {
  const supabase = createServerSupabaseClient();

  // Get invoice with related data
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select(
      `
      *,
      customers(*),
      invoice_items(*)
    `,
    )
    .eq("id", invoiceId)
    .single();

  if (invoiceError) {
    console.error("Error fetching invoice:", invoiceError);
    throw new Error("Failed to fetch invoice data");
  }

  // Get company profile
  const { data: companyProfile, error: profileError } = await supabase
    .from("company_profile")
    .select("*")
    .limit(1)
    .single();

  if (profileError) {
    console.error("Error fetching company profile:", profileError);
    throw new Error("Failed to fetch company profile");
  }

  // Return the data needed for PDF generation
  return { invoice, companyProfile };
}
