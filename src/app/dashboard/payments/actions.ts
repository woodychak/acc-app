"use server";

import { createServerSupabaseClient } from "../../../../supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createPaymentAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  try {
    const invoice_id = formData.get("invoice_id") as string;
    const amount = Number(formData.get("amount") || 0);
    const payment_date = formData.get("payment_date") as string;
    const payment_method = formData.get("payment_method") as string;
    const reference_number = formData.get("reference_number") as string;
    const notes = formData.get("notes") as string;
    const currency_code = formData.get("currency_code") as string;

    // Insert the payment
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        invoice_id,
        amount,
        payment_date,
        payment_method,
        reference_number,
        notes,
        currency_code,
        user_id: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (paymentError) {
      console.error("Error creating payment:", paymentError);
      throw new Error(`Failed to create payment: ${paymentError.message}`);
    }

    // Update the invoice status to paid
    const { error: invoiceError } = await supabase
      .from("invoices")
      .update({ status: "paid", updated_at: new Date().toISOString() })
      .eq("id", invoice_id);

    if (invoiceError) {
      console.error("Error updating invoice status:", invoiceError);
      throw new Error(
        `Failed to update invoice status: ${invoiceError.message}`,
      );
    }

    revalidatePath("/dashboard/payments");
    return { success: true };
  } catch (error) {
    console.error("Error in createPaymentAction:", error);
    throw error;
  }
}

export async function deletePaymentAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
    return;
  }

  try {
    const id = formData.get("id") as string;

    // Delete the payment
    const { error } = await supabase.from("payments").delete().eq("id", id);

    if (error) {
      console.error("Error deleting payment:", error);
      throw new Error(`Failed to delete payment: ${error.message}`);
    }

    revalidatePath("/dashboard/payments");
  } catch (error) {
    console.error("Error deleting payment:", error);
    throw error;
  }
  return;  // 明確回傳 void
}

export async function markInvoicePaidAction(formData: FormData): Promise<void> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
    return;
  }

  try {
    const invoice_id = formData.get("invoice_id") as string;

    // Get invoice details
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("total_amount, currency_code")
      .eq("id", invoice_id)
      .single();

    if (invoiceError) {
      console.error("Error fetching invoice:", invoiceError);
      throw new Error(`Failed to fetch invoice: ${invoiceError.message}`);
      return;
    }

    // Create a payment record
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        invoice_id,
        amount: invoice.total_amount,
        payment_date: new Date().toISOString().split("T")[0],
        payment_method: "other",
        reference_number: "Marked as paid",
        notes: "Invoice marked as paid directly",
        currency_code: invoice.currency_code,
        user_id: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (paymentError) {
      console.error("Error creating payment:", paymentError);
      throw new Error(`Failed to create payment: ${paymentError.message}`);
    }

    // Update the invoice status to paid
    const { error: updateError } = await supabase
      .from("invoices")
      .update({ status: "paid", updated_at: new Date().toISOString() })
      .eq("id", invoice_id);

    if (updateError) {
      console.error("Error updating invoice status:", updateError);
      throw new Error(
        `Failed to update invoice status: ${updateError.message}`,
      );
    }

    revalidatePath("/dashboard/payments");
  } catch (error) {
    console.error("Error in markInvoicePaidAction:", error);
    throw error;
  }
}
