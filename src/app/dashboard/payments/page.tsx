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
import { createClient } from "../../../supabase/server";
import { deletePaymentAction, markInvoicePaidAction } from "./actions";

export default async function PaymentsPage() {
  const supabase = await createClient();

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
    .order("due_date", { ascending: true });

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
      invoices (invoice_number, customers (name))
    `,
    )
    .eq("user_id", user.id) // 👈 Filter by current user
    .order("payment_date", { ascending: false })
    .limit(10);

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
      <main className="w-full">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold">Payments</h1>
              <p className="text-muted-foreground">Track and manage payments</p>
            </div>
            <Link href="/dashboard/payments/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Record Payment
              </Button>
            </Link>
          </div>

          {/* Unpaid Invoices Section */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Unpaid Invoices</h2>
            {unpaidInvoices && unpaidInvoices.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-muted">
                      <th className="px-4 py-2 text-left">Invoice #</th>
                      <th className="px-4 py-2 text-left">Customer</th>
                      <th className="px-4 py-2 text-left">Issue Date</th>
                      <th className="px-4 py-2 text-left">Due Date</th>
                      <th className="px-4 py-2 text-left">Amount</th>
                      <th className="px-4 py-2 text-left">Status</th>
                      <th className="px-4 py-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unpaidInvoices.map((invoice) => (
                      <tr
                        key={invoice.id}
                        className="border-b hover:bg-muted/50"
                      >
                        <td className="px-4 py-2">
                          <Link
                            href={`/dashboard/invoices/${invoice.id}`}
                            className="text-primary hover:underline"
                          >
                            {invoice.invoice_number}
                          </Link>
                        </td>
                        <td className="px-4 py-2">{invoice.customers?.[0]?.name}</td>
                        <td className="px-4 py-2">
                          {formatDate(invoice.issue_date)}
                        </td>
                        <td className="px-4 py-2">
                          {formatDate(invoice.due_date)}
                        </td>
                        <td className="px-4 py-2">
                          {formatCurrency(
                            invoice.total_amount,
                            invoice.currency_code,
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`inline-block px-2 py-1 text-xs rounded-full ${
                              invoice.status === "overdue"
                                ? "bg-red-100 text-red-800"
                                : invoice.status === "sent"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {invoice.status.charAt(0).toUpperCase() +
                              invoice.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex space-x-2">
                            <Link
                              href={`/dashboard/payments/new?invoice=${invoice.id}`}
                            >
                              <Button size="sm" variant="outline">
                                Record Payment
                              </Button>
                            </Link>
                            <form action={markInvoicePaidAction}>
                              <input
                                type="hidden"
                                name="invoice_id"
                                value={invoice.id}
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-green-600"
                                type="submit"
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Mark Paid
                              </Button>
                            </form>
                            <Link
                              href={`/dashboard/invoices/${invoice.id}/pdf`}
                              target="_blank"
                            >
                              <Button size="sm" variant="ghost">
                                <FileText className="h-4 w-4" />
                              </Button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-card rounded-xl p-6 border shadow-sm text-center">
                <p className="text-muted-foreground">
                  No unpaid invoices found.
                </p>
              </div>
            )}
          </div>

          {/* Recent Payments Section */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Recent Payments</h2>
            {payments && payments.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-muted">
                      <th className="px-4 py-2 text-left">Date</th>
                      <th className="px-4 py-2 text-left">Invoice</th>
                      <th className="px-4 py-2 text-left">Customer</th>
                      <th className="px-4 py-2 text-left">Method</th>
                      <th className="px-4 py-2 text-left">Reference</th>
                      <th className="px-4 py-2 text-left">Amount</th>
                      <th className="px-4 py-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment) => (
                      <tr
                        key={payment.id}
                        className="border-b hover:bg-muted/50"
                      >
                        <td className="px-4 py-2">
                          {formatDate(payment.payment_date)}
                        </td>
                        <td className="px-4 py-2">
                        {payment.invoices && payment.invoices.length > 0 ? (
                              <Link
                              href={`/dashboard/invoices/${(payment.invoices[0] as any).id}`}
                                className="text-primary hover:underline"
                              >
                                {payment.invoices[0].invoice_number}
                              </Link>
                          ) : (
                            "N/A"
                          )}
                        </td>
                        <td className="px-4 py-2">
                        {payment.invoices && payment.invoices.length > 0
                          ? payment.invoices[0].customers?.[0]?.name || "N/A"
                          : "N/A"}
                        </td>
                        <td className="px-4 py-2">{payment.payment_method}</td>
                        <td className="px-4 py-2">
                          {payment.reference_number || "N/A"}
                        </td>
                        <td className="px-4 py-2">
                          {formatCurrency(
                            payment.amount,
                            payment.currency_code,
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <form action={deletePaymentAction}>
                            <input type="hidden" name="id" value={payment.id} />
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-500 hover:text-red-700"
                              type="submit"
                            >
                              <AlertCircle className="h-4 w-4 mr-1" />
                              Delete
                            </Button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-card rounded-xl p-8 border shadow-sm">
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="bg-primary/10 p-4 rounded-full mb-4">
                    <CreditCard className="h-12 w-12 text-primary" />
                  </div>
                  <h2 className="text-2xl font-semibold mb-2">
                    No payments yet
                  </h2>
                  <p className="text-muted-foreground max-w-md mb-6">
                    Get started by recording your first payment.
                  </p>
                  <Link href="/dashboard/payments/new">
                    <Button>
                      <Plus className="mr-2 h-4 w-4" /> Record Your First
                      Payment
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Bank Account Information */}
          {companyProfile?.bank_account && (
            <div className="mt-8 bg-blue-50 border border-blue-200 rounded-md p-4">
              <h3 className="font-medium text-blue-800 mb-2">
                Company Bank Account Details
              </h3>
              <pre className="whitespace-pre-wrap text-sm text-blue-700">
                {companyProfile.bank_account}
              </pre>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
