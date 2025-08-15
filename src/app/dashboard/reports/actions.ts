"use server";

import { createServerSupabaseClient } from "../../../../supabase/server";
import { redirect } from "next/navigation";

export async function getFinancialReports() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  try {
    // Get revenue data from payments
    const { data: payments, error: paymentsError } = await supabase
      .from("payments")
      .select(
        `
        amount,
        currency_code,
        payment_date,
        payment_method,
        invoices!inner(
          invoice_number,
          customers(
            name
          )
        )
      `,
      )
      .eq("user_id", user.id)
      .order("payment_date", { ascending: false });

    if (paymentsError) {
      console.error("Error fetching payments:", paymentsError);
    }

    // Get expense data
    const { data: expenses, error: expensesError } = await supabase
      .from("expenses")
      .select("*")
      .eq("user_id", user.id)
      .order("expense_date", { ascending: false });

    if (expensesError) {
      console.error("Error fetching expenses:", expensesError);
    }

    // Get outstanding invoices
    const { data: outstandingInvoices, error: outstandingError } =
      await supabase
        .from("invoices")
        .select(
          `
        id,
        invoice_number,
        total_amount,
        currency_code,
        due_date,
        customers(
          name
        )
      `,
        )
        .eq("user_id", user.id)
        .neq("status", "paid")
        .order("due_date", { ascending: true });

    if (outstandingError) {
      console.error("Error fetching outstanding invoices:", outstandingError);
    }

    // Calculate totals
    const totalRevenue =
      payments?.reduce((sum, payment) => sum + Number(payment.amount), 0) || 0;
    const totalExpenses =
      expenses?.reduce((sum, expense) => sum + Number(expense.amount), 0) || 0;
    const totalOutstanding =
      outstandingInvoices?.reduce(
        (sum, invoice) => sum + Number(invoice.total_amount),
        0,
      ) || 0;
    const netCashFlow = totalRevenue - totalExpenses;

    // Group revenue by month
    const revenueByMonth =
      payments?.reduce(
        (acc, payment) => {
          const month = new Date(payment.payment_date).toLocaleDateString(
            "en-US",
            { year: "numeric", month: "short" },
          );
          acc[month] = (acc[month] || 0) + Number(payment.amount);
          return acc;
        },
        {} as Record<string, number>,
      ) || {};

    // Group expenses by category
    const expensesByCategory =
      expenses?.reduce(
        (acc, expense) => {
          const category = expense.category || "Other";
          acc[category] = (acc[category] || 0) + Number(expense.amount);
          return acc;
        },
        {} as Record<string, number>,
      ) || {};

    // Group expenses by month
    const expensesByMonth =
      expenses?.reduce(
        (acc, expense) => {
          const month = new Date(expense.expense_date).toLocaleDateString(
            "en-US",
            { year: "numeric", month: "short" },
          );
          acc[month] = (acc[month] || 0) + Number(expense.amount);
          return acc;
        },
        {} as Record<string, number>,
      ) || {};

    return {
      totalRevenue,
      totalExpenses,
      totalOutstanding,
      netCashFlow,
      revenueByMonth,
      expensesByCategory,
      expensesByMonth,
      payments: payments || [],
      expenses: expenses || [],
      outstandingInvoices: outstandingInvoices || [],
    };
  } catch (error) {
    console.error("Error in getFinancialReports:", error);
    throw error;
  }
}

export async function generateFinancialReport(
  reportType: "revenue" | "expense" | "cashflow",
) {
  const data = await getFinancialReports();

  // This would generate a PDF or CSV report
  // For now, we'll return the data that can be used by the client
  return {
    reportType,
    generatedAt: new Date().toISOString(),
    data,
  };
}
