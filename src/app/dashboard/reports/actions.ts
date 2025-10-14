"use server";

import { createServerSupabaseClient } from "../../../../supabase/server";
import { redirect } from "next/navigation";

export async function getFinancialReports(fromDate?: Date, toDate?: Date) {
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
      .from("company_profile")
      .select("default_currency")
      .eq("user_id", user.id)
      .single();

    if (companyError) {
      console.error("Error fetching company profile:", companyError);
    }

    const defaultCurrency = companyProfile?.default_currency || "USD";

    // Get all user currencies with symbols and start balance
    const { data: currencies, error: currenciesError } = await supabase
      .from("currencies")
      .select("code, symbol, start_balance")
      .eq("user_id", user.id);

    if (currenciesError) {
      console.error("Error fetching currencies:", currenciesError);
    }

    // Create currency symbol map and starting balance
    const currencySymbols = currencies?.reduce((acc, curr) => {
      acc[curr.code] = curr.symbol;
      return acc;
    }, {} as Record<string, string>) || {};

    const startingBalanceByCurrency = currencies?.reduce((acc, curr) => {
      acc[curr.code] = Number(curr.start_balance) || 0;
      return acc;
    }, {} as Record<string, number>) || {};

    // Add default symbols for common currencies if not found
    const defaultSymbols: Record<string, string> = {
      USD: "US$",
      EUR: "€",
      GBP: "£",
      JPY: "¥",
      CAD: "C$",
      AUD: "A$",
      HKD: "HK$",
      SGD: "S$",
      CNY: "¥"
    };

    // Fetch all invoices with date filter
    let invoicesQuery = supabase
      .from("invoices")
      .select(
        `
        id,
        invoice_number,
        issue_date,
        total_amount,
        currency_code,
        status,
        customers(
          name
        ),
        payments(
          id,
          amount,
          payment_date,
          payment_method
        )
      `,
      )
      .eq("user_id", user.id);

    if (fromDate) {
      const startDate = new Date(fromDate);
      startDate.setHours(0, 0, 0, 0);
      invoicesQuery = invoicesQuery.gte("issue_date", startDate.toISOString());
    }
    if (toDate) {
      const endDate = new Date(toDate);
      endDate.setHours(23, 59, 59, 999);
      invoicesQuery = invoicesQuery.lte("issue_date", endDate.toISOString());
    }

    const { data: invoices, error: invoicesError } = await invoicesQuery.order("issue_date", { ascending: false });

    if (invoicesError) {
      console.error("Error fetching invoices:", invoicesError);
    }

    // Transform invoices into payment-like records for the report
    const payments = invoices?.flatMap((invoice) => {
      // If invoice has payments, create a record for each payment
      if (invoice.payments && Array.isArray(invoice.payments) && invoice.payments.length > 0) {
        return invoice.payments.map((payment: any) => ({
          id: payment.id,
          amount: payment.amount,
          currency_code: invoice.currency_code,
          payment_date: payment.payment_date,
          payment_method: payment.payment_method,
          invoices: {
            invoice_number: invoice.invoice_number,
            issue_date: invoice.issue_date,
            customers: invoice.customers,
          },
        }));
      }
      // If no payments, create a record with the invoice total
      return [{
        id: `invoice-${invoice.id}`,
        amount: invoice.total_amount,
        currency_code: invoice.currency_code,
        payment_date: invoice.issue_date, // Use issue_date as fallback
        payment_method: invoice.status === "paid" ? "Unknown" : "Unpaid",
        invoices: {
          invoice_number: invoice.invoice_number,
          issue_date: invoice.issue_date,
          customers: invoice.customers,
        },
      }];
    }) || [];

    // Build query for expenses with date filter - using expense_date
    let expensesQuery = supabase
      .from("expenses")
      .select("*")
      .eq("user_id", user.id);

    if (fromDate) {
      // Set to start of day
      const startDate = new Date(fromDate);
      startDate.setHours(0, 0, 0, 0);
      expensesQuery = expensesQuery.gte("expense_date", startDate.toISOString());
    }
    if (toDate) {
      // Set to end of day
      const endDate = new Date(toDate);
      endDate.setHours(23, 59, 59, 999);
      expensesQuery = expensesQuery.lte("expense_date", endDate.toISOString());
    }

    const { data: expenses, error: expensesError } = await expensesQuery.order("expense_date", { ascending: false });

    if (expensesError) {
      console.error("Error fetching expenses:", expensesError);
    }

    // Get outstanding invoices (not filtered by date)
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
      startingBalanceByCurrency,
      currencySymbols: { ...defaultSymbols, ...currencySymbols },
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

export async function downloadRevenueReport(fromDate?: Date, toDate?: Date) {
  const data = await getFinancialReports(fromDate, toDate);

  const periodText = fromDate && toDate 
    ? `${fromDate.toLocaleDateString()} to ${toDate.toLocaleDateString()}`
    : "All Time";

  // Generate filename with date range
  const filenamePeriod = fromDate && toDate
    ? `${fromDate.toISOString().split("T")[0]}_to_${toDate.toISOString().split("T")[0]}`
    : "all-time";

  // Generate CSV content for revenue report with balance
  let csvContent = `Revenue Report - ${periodText}\n\n`;
  
  // Add starting balance section
  csvContent += "Starting Balance by Currency\n";
  csvContent += "Currency,Starting Balance\n";
  Object.entries(data.startingBalanceByCurrency).forEach(([currency, balance]) => {
    csvContent += `"${currency}","${balance}"\n`;
  });
  csvContent += "\n";

  // Add revenue transactions
  csvContent += "Revenue Transactions\n";
  csvContent += "Payment Date,Invoice Date,Customer,Invoice Number,Amount,Currency,Payment Method\n";
  const csvRows = data.payments
    .map((payment) => {
      const paymentDate = new Date(payment.payment_date).toLocaleDateString();
      const invoiceDate = (payment.invoices as any)?.issue_date 
        ? new Date((payment.invoices as any).issue_date).toLocaleDateString()
        : "N/A";
      const customer =
        (payment.invoices as any)?.customers?.name || "Unknown Customer";
      const invoiceNumber = (payment.invoices as any)?.invoice_number || "N/A";
      const amount = payment.amount;
      const currency = payment.currency_code || data.defaultCurrency;
      const method = payment.payment_method || "N/A";
      return `"${paymentDate}","${invoiceDate}","${customer}","${invoiceNumber}","${amount}","${currency}","${method}"`;
    })
    .join("\n");
  csvContent += csvRows + "\n\n";

  // Add summary
  csvContent += "Summary by Currency\n";
  csvContent += "Currency,Starting Balance,Revenue,Ending Balance\n";
  const allCurrencies = new Set([
    ...Object.keys(data.startingBalanceByCurrency),
    ...Object.keys(data.revenueByCurrency),
  ]);
  allCurrencies.forEach((currency) => {
    const starting = data.startingBalanceByCurrency[currency] || 0;
    const revenue = data.revenueByCurrency[currency] || 0;
    const ending = starting + revenue;
    csvContent += `"${currency}","${starting}","${revenue}","${ending}"\n`;
  });

  return {
    filename: `revenue-report-${filenamePeriod}.csv`,
    content: csvContent,
    contentType: "text/csv",
  };
}

export async function downloadExpenseReport(fromDate?: Date, toDate?: Date) {
  const data = await getFinancialReports(fromDate, toDate);

  const periodText = fromDate && toDate 
    ? `${fromDate.toLocaleDateString()} to ${toDate.toLocaleDateString()}`
    : "All Time";

  // Generate filename with date range
  const filenamePeriod = fromDate && toDate
    ? `${fromDate.toISOString().split("T")[0]}_to_${toDate.toISOString().split("T")[0]}`
    : "all-time";

  // Generate CSV content for expense report with balance
  let csvContent = `Expense Report - ${periodText}\n\n`;
  
  // Add starting balance section
  csvContent += "Starting Balance by Currency\n";
  csvContent += "Currency,Starting Balance\n";
  Object.entries(data.startingBalanceByCurrency).forEach(([currency, balance]) => {
    csvContent += `"${currency}","${balance}"\n`;
  });
  csvContent += "\n";

  // Add expense transactions
  csvContent += "Expense Transactions\n";
  csvContent += "Date,Title,Category,Amount,Currency,Payment Method,Description\n";
  const csvRows = data.expenses
    .map((expense) => {
      const date = new Date(expense.expense_date).toLocaleDateString();
      const title = expense.title || "N/A";
      const category = expense.category || "Other";
      const amount = expense.amount;
      const currency = expense.currency_code || data.defaultCurrency;
      const method = expense.payment_method || "N/A";
      const description = expense.description || "";
      return `"${date}","${title}","${category}","${amount}","${currency}","${method}","${description}"`;
    })
    .join("\n");
  csvContent += csvRows + "\n\n";

  // Add summary
  csvContent += "Summary by Currency\n";
  csvContent += "Currency,Starting Balance,Expenses,Ending Balance\n";
  const allCurrencies = new Set([
    ...Object.keys(data.startingBalanceByCurrency),
    ...Object.keys(data.expensesByCurrency),
  ]);
  allCurrencies.forEach((currency) => {
    const starting = data.startingBalanceByCurrency[currency] || 0;
    const expenses = data.expensesByCurrency[currency] || 0;
    const ending = starting - expenses;
    csvContent += `"${currency}","${starting}","${expenses}","${ending}"\n`;
  });

  return {
    filename: `expense-report-${filenamePeriod}.csv`,
    content: csvContent,
    contentType: "text/csv",
  };
}

export async function downloadCashFlowReport(fromDate?: Date, toDate?: Date) {
  const data = await getFinancialReports(fromDate, toDate);

  const periodText = fromDate && toDate 
    ? `${fromDate.toLocaleDateString()} to ${toDate.toLocaleDateString()}`
    : "All Time";

  // Generate filename with date range
  const filenamePeriod = fromDate && toDate
    ? `${fromDate.toISOString().split("T")[0]}_to_${toDate.toISOString().split("T")[0]}`
    : "all-time";

  // Generate CSV content for cash flow report with balance
  let csvContent = `Cash Flow Report - ${periodText}\n\n`;
  
  // Add starting balance section
  csvContent += "Starting Balance by Currency\n";
  csvContent += "Currency,Starting Balance\n";
  Object.entries(data.startingBalanceByCurrency).forEach(([currency, balance]) => {
    csvContent += `"${currency}","${balance}"\n`;
  });
  csvContent += "\n";

  // Add monthly cash flow
  csvContent += "Monthly Cash Flow\n";
  csvContent += "Month,Revenue,Expenses,Net Cash Flow\n";
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
  csvContent += csvRows + "\n\n";

  // Add summary by currency
  csvContent += "Summary by Currency\n";
  csvContent += "Currency,Starting Balance,Revenue,Expenses,Ending Balance\n";
  const allCurrencies = new Set([
    ...Object.keys(data.startingBalanceByCurrency),
    ...Object.keys(data.revenueByCurrency),
    ...Object.keys(data.expensesByCurrency),
  ]);
  allCurrencies.forEach((currency) => {
    const starting = data.startingBalanceByCurrency[currency] || 0;
    const revenue = data.revenueByCurrency[currency] || 0;
    const expenses = data.expensesByCurrency[currency] || 0;
    const ending = starting + revenue - expenses;
    csvContent += `"${currency}","${starting}","${revenue}","${expenses}","${ending}"\n`;
  });

  return {
    filename: `cashflow-report-${filenamePeriod}.csv`,
    content: csvContent,
    contentType: "text/csv",
  };
}