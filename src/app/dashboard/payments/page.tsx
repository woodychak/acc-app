import DashboardNavbar from "@/components/dashboard-navbar";
import { Button } from "@/components/ui/button";
import {
  CreditCard,
  Plus,
  FileText,
  AlertCircle,
  Check,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "../../../../supabase/server";
import { deletePaymentAction, markInvoicePaidAction } from "./actions";
import type { Invoice, InvoiceSelected, PaymentSelected } from "@/app/types";
import PaymentsClient from "./client";

export default async function PaymentsPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  // Fetch company profile for default currency
  const { data: companyProfile } = await supabase
    .from("company_profile")
    .select("default_currency, bank_account")
    .single();

  const defaultCurrency = companyProfile?.default_currency || "HKD";

  // Fetch unpaid invoices

  const { data: unpaidInvoices, error: unpaidError } = await supabase
    .from("invoices")
    .select(
      `
      id,
      invoice_number,
      issue_date,
      due_date,
      total_amount,
      currency_code,
      status,
      customers (name)
    `,
    )
    .eq("user_id", user.id) // 👈 Filter by current user
    .in("status", ["draft", "sent", "overdue"])
    .order("due_date", { ascending: true })
    .returns<InvoiceSelected[]>();

  // Fetch recent payments
  const { data: payments, error: paymentsError } = await supabase
    .from("payments")
    .select(
      `
      id,
      payment_date,
      amount,
      payment_method,
      reference_number,
      currency_code,
      invoice_id,
      invoices:invoice_id (invoice_number, customers (name))
    `,
    )
    .eq("user_id", user.id) // 👈 Filter by current user
    .order("payment_date", { ascending: false })
    .returns<PaymentSelected[]>();

  const formatCurrency = (
    amount: number,
    currency: string = defaultCurrency,
  ) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <>
      <DashboardNavbar />
      <PaymentsClient
        unpaidInvoices={unpaidInvoices || []}
        payments={payments || []}
        defaultCurrency={defaultCurrency}
        companyProfile={companyProfile}
      />
    </>
  );
}
