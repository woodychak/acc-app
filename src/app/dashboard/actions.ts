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

    // Get all user currencies with symbols
    const { data: currencies, error: currenciesError } = await supabase
      .from("currencies")
      .select("code, symbol")
      .eq("user_id", user.id);

    if (currenciesError) {
      console.error("Error fetching currencies:", currenciesError);
    }

    // Create currency symbol map
    const currencySymbols = currencies?.reduce((acc, curr) => {
      acc[curr.code] = curr.symbol;
      return acc;
    }, {} as Record<string, string>) || {};

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

    // Get revenue data from payments with currency breakdown
    const { data: payments, error: paymentsError } = await supabase
      .from("payments")
      .select("amount, currency_code, payment_date")
      .eq("user_id", user.id);

    if (paymentsError) {
      console.error("Error fetching payments:", paymentsError);
    }

    // Get outstanding invoices with currency breakdown
    const { data: outstandingInvoices, error: outstandingError } =
      await supabase
        .from("invoices")
        .select("total_amount, currency_code")
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

    // Group revenue by currency
    const revenueByCurrency = payments?.reduce((acc, payment) => {
      const currency = payment.currency_code || defaultCurrency;
      acc[currency] = (acc[currency] || 0) + Number(payment.amount);
      return acc;
    }, {} as Record<string, number>) || {};

    // Group outstanding by currency
    const outstandingByCurrency = outstandingInvoices?.reduce((acc, invoice) => {
      const currency = invoice.currency_code || defaultCurrency;
      acc[currency] = (acc[currency] || 0) + Number(invoice.total_amount);
      return acc;
    }, {} as Record<string, number>) || {};

    // Group revenue by month for chart data
    const revenueByMonth = payments?.reduce((acc, payment) => {
      const month = new Date(payment.payment_date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
      });
      const currency = payment.currency_code || defaultCurrency;
      if (!acc[month]) acc[month] = {};
      acc[month][currency] = (acc[month][currency] || 0) + Number(payment.amount);
      return acc;
    }, {} as Record<string, Record<string, number>>) || {};

    // Calculate totals (keeping for backward compatibility)
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
      revenueByCurrency,
      outstandingByCurrency,
      revenueByMonth,
      defaultCurrency,
      currencySymbols: { ...defaultSymbols, ...currencySymbols },
    };
  } catch (error) {
    console.error("Error in getDashboardData:", error);
    throw error;
  }
}