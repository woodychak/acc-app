"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useRef, Suspense } from "react";
import DashboardNavbar from "@/components/dashboard-navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/client";
import { createPaymentAction } from "../actions";
import { Invoice, CompanyProfile } from "@/app/types";

function PaymentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [unpaidInvoices, setUnpaidInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [amount, setAmount] = useState(0);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(
    null,
  );
  const [defaultCurrency, setDefaultCurrency] = useState("HKD");
  const [currencies, setCurrencies] = useState<
    Array<{
      id: string;
      code: string;
      name: string;
      symbol: string;
      is_default: boolean;
    }>
  >([]);

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/sign-in";
        return;
      }

      const { data: invoicesRaw } = await supabase
        .from("invoices")
        .select(
          `
          id,
          invoice_number,
          customer_id,
          issue_date,
          due_date,
          total_amount,
          currency_code,
          status,
          notes,
          customer:customers!customer_id (
            name
          )
        `,
        )
        .eq("user_id", user.id)
        .in("status", ["draft", "sent", "overdue"])
        .order("due_date", { ascending: true });

      const invoices = (invoicesRaw as unknown as Invoice[]) ?? [];
      setUnpaidInvoices(invoices);

      const invoiceId = searchParams.get("invoice");
      if (invoiceId) {
        const invoice = invoices.find((inv) => inv.id === invoiceId);
        if (invoice) {
          setSelectedInvoice(invoice);
          setAmount(invoice.total_amount ?? 0);
          setDefaultCurrency(invoice.currency_code || "HKD");
        }
      }

      const { data: profileData } = await supabase
        .from("company_profile")
        .select("*")
        .limit(1)
        .single<CompanyProfile>();

      if (profileData) {
        setCompanyProfile(profileData);
      }

      // Get currencies for the current user
      const { data: currencies } = await supabase
        .from("currencies")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("is_default", { ascending: false })
        .order("code", { ascending: true });

      setCurrencies(currencies || []);

      if (!selectedInvoice) {
        const defaultCurr =
          currencies?.find((c) => c.is_default)?.code || "HKD";
        setDefaultCurrency(defaultCurr);
      }
    };

    fetchData();
  }, [searchParams]);

  const handleInvoiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const invoiceId = e.target.value;
    const invoice = unpaidInvoices.find((inv) => inv.id === invoiceId);
    setSelectedInvoice(invoice || null);
    if (invoice) {
      setAmount(invoice.total_amount ?? 0);
      setDefaultCurrency(invoice.currency_code || "HKD");
    } else {
      setAmount(0);
    }
  };

  const formatCurrency = (amount: number | undefined) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: defaultCurrency,
    }).format(amount ?? 0);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      if (!selectedInvoice) {
        setError("Please select an invoice");
        setIsSubmitting(false);
        return;
      }

      if (!formRef.current) {
        setError("Form not available.");
        setIsSubmitting(false);
        return;
      }

      const formData = new FormData(formRef.current);
      await createPaymentAction(formData);
      router.push("/dashboard/payments");
    } catch (error) {
      console.error("Error submitting payment:", error);
      setError(
        "Failed to record payment. Please check all fields and try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <DashboardNavbar />
      <main className="w-full">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center mb-6">
            <Link href="/dashboard/payments" className="mr-4">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Record Payment</h1>
              <p className="text-muted-foreground">
                Record a payment for an invoice
              </p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
              {error}
            </div>
          )}

          <div className="bg-card rounded-xl p-6 border shadow-sm">
            <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="invoice_id">Invoice *</Label>
                  <select
                    id="invoice_id"
                    name="invoice_id"
                    required
                    value={selectedInvoice?.id || ""}
                    onChange={handleInvoiceChange}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select an invoice</option>
                    {unpaidInvoices.map((invoice) => (
                      <option key={invoice.id} value={invoice.id}>
                        {invoice.invoice_number} - {invoice.customer?.name} (
                        {formatCurrency(invoice.total_amount)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payment_date">Payment Date *</Label>
                  <Input
                    id="payment_date"
                    name="payment_date"
                    type="date"
                    defaultValue={new Date().toISOString().split("T")[0]}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">Amount *</Label>
                  <Input
                    id="amount"
                    name="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency_code">Currency</Label>
                  <select
                    id="currency_code"
                    name="currency_code"
                    value={defaultCurrency}
                    onChange={(e) => setDefaultCurrency(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {currencies.map((currency) => (
                      <option key={currency.id} value={currency.code}>
                        {currency.code} - {currency.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payment_method">Payment Method *</Label>
                  <select
                    id="payment_method"
                    name="payment_method"
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select payment method</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="credit_card">Credit Card</option>
                    <option value="cash">Cash</option>
                    <option value="check">Check</option>
                    <option value="paypal">PayPal</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reference_number">Reference Number</Label>
                  <Input
                    id="reference_number"
                    name="reference_number"
                    placeholder="Transaction or check number"
                  />
                </div>
              </div>

              {companyProfile?.bank_account && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
                  <h3 className="font-medium text-blue-800 mb-2">
                    Company Bank Account Details
                  </h3>
                  <pre className="whitespace-pre-wrap text-sm text-blue-700">
                    {companyProfile.bank_account}
                  </pre>
                </div>
              )}

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  placeholder="Additional notes about this payment"
                  rows={4}
                />
              </div>

              <div className="flex justify-end gap-3">
                <Link href="/dashboard/payments">
                  <Button variant="outline" type="button">
                    Cancel
                  </Button>
                </Link>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Save Payment"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </>
  );
}

export default function NewPaymentPage() {
  return (
    <Suspense fallback={<div className="p-4">Loading...</div>}>
      <PaymentForm />
    </Suspense>
  );
}
