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
    // Get company profile for default currency
    const { data: companyProfile, error: companyError } = await supabase
      .from("company_profiles")
      .select("default_currency")
      .eq("user_id", user.id)
      .single();

    if (companyError) {
      console.error("Error fetching company profile:", companyError);
    }

    const defaultCurrency = companyProfile?.default_currency || "USD";

    // Get revenue data from payments
    const { data: payments, error: paymentsError } = await supabase
      .from("payments")
      .select(
        `
        id,
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

    // Group data by currency
    const revenueByCurrency =
      payments?.reduce(
        (acc, payment) => {
          const currency = payment.currency_code || defaultCurrency;
          acc[currency] = (acc[currency] || 0) + Number(payment.amount);
          return acc;
        },
        {} as Record<string, number>,
      ) || {};

    const expensesByCurrency =
      expenses?.reduce(
        (acc, expense) => {
          const currency = expense.currency_code || defaultCurrency;
          acc[currency] = (acc[currency] || 0) + Number(expense.amount);
          return acc;
        },
        {} as Record<string, number>,
      ) || {};

    const outstandingByCurrency =
      outstandingInvoices?.reduce(
        (acc, invoice) => {
          const currency = invoice.currency_code || defaultCurrency;
          acc[currency] = (acc[currency] || 0) + Number(invoice.total_amount);
          return acc;
        },
        {} as Record<string, number>,
      ) || {};

    // Calculate totals (keeping for backward compatibility)
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
      defaultCurrency,
      revenueByCurrency,
      expensesByCurrency,
      outstandingByCurrency,
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

export async function downloadRevenueReport() {
  const data = await getFinancialReports();

  // Generate CSV content for revenue report
  const csvHeaders = "Date,Customer,Invoice Number,Amount,Payment Method\n";
  const csvRows = data.payments
    .map((payment) => {
      const date = new Date(payment.payment_date).toLocaleDateString();
      const customer =
        (payment.invoices as any)?.customers?.name || "Unknown Customer";
      const invoiceNumber = (payment.invoices as any)?.invoice_number || "N/A";
      const amount = payment.amount;
      const method = payment.payment_method || "N/A";
      return `"${date}","${customer}","${invoiceNumber}","${amount}","${method}"`;
    })
    .join("\n");

  return {
    filename: `revenue-report-${new Date().toISOString().split("T")[0]}.csv`,
    content: csvHeaders + csvRows,
    contentType: "text/csv",
  };
}

export async function downloadExpenseReport() {
  const data = await getFinancialReports();

  // Generate CSV content for expense report
  const csvHeaders = "Date,Title,Category,Amount,Payment Method,Description\n";
  const csvRows = data.expenses
    .map((expense) => {
      const date = new Date(expense.expense_date).toLocaleDateString();
      const title = expense.title || "N/A";
      const category = expense.category || "Other";
      const amount = expense.amount;
      const method = expense.payment_method || "N/A";
      const description = expense.description || "";
      return `"${date}","${title}","${category}","${amount}","${method}","${description}"`;
    })
    .join("\n");

  return {
    filename: `expense-report-${new Date().toISOString().split("T")[0]}.csv`,
    content: csvHeaders + csvRows,
    contentType: "text/csv",
  };
}

export async function downloadCashFlowReport() {
  const data = await getFinancialReports();

  // Generate CSV content for cash flow report
  const csvHeaders = "Month,Revenue,Expenses,Net Cash Flow\n";
  const allMonths = new Set([
    ...Object.keys(data.revenueByMonth),
    ...Object.keys(data.expensesByMonth),
  ]);

  const csvRows = Array.from(allMonths)
    .map((month) => {
      const revenue = data.revenueByMonth[month] || 0;
      const expenses = data.expensesByMonth[month] || 0;
      const netFlow = revenue - expenses;
      return `"${month}","${revenue}","${expenses}","${netFlow}"`;
    })
    .join("\n");

  return {
    filename: `cashflow-report-${new Date().toISOString().split("T")[0]}.csv`,
    content: csvHeaders + csvRows,
    contentType: "text/csv",
  };
}
