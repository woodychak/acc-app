"use server";

import { createServerSupabaseClient } from "../../../supabase/server";
import { redirect } from "next/navigation";

export async function getDashboardData() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  try {
    // Get total revenue from payments
    const { data: payments, error: paymentsError } = await supabase
      .from("payments")
      .select("amount")
      .eq("user_id", user.id);

    if (paymentsError) {
      console.error("Error fetching payments:", paymentsError);
    }

    // Get outstanding invoices (not paid)
    const { data: outstandingInvoices, error: outstandingError } =
      await supabase
        .from("invoices")
        .select("total_amount")
        .eq("user_id", user.id)
        .neq("status", "paid");

    if (outstandingError) {
      console.error("Error fetching outstanding invoices:", outstandingError);
    }

    // Get total customers count
    const { count: customersCount, error: customersError } = await supabase
      .from("customers")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (customersError) {
      console.error("Error fetching customers count:", customersError);
    }

    // Calculate totals
    const totalRevenue =
      payments?.reduce((sum, payment) => sum + Number(payment.amount), 0) || 0;
    const totalOutstanding =
      outstandingInvoices?.reduce(
        (sum, invoice) => sum + Number(invoice.total_amount),
        0,
      ) || 0;
    const totalCustomers = customersCount || 0;

    return {
      totalRevenue,
      totalOutstanding,
      totalCustomers,
    };
  } catch (error) {
    console.error("Error in getDashboardData:", error);
    throw error;
  }
}
