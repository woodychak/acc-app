"use client";

import DashboardNavbar from "@/components/dashboard-navbar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail, FileCheck, Edit, Trash2, Download, Printer } from "lucide-react";
import Link from "next/link";
import { createClient } from "../../../../../supabase/client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Quotation } from "@/app/types";
import { convertQuotationToInvoiceAction, sendQuotationEmailAction } from "../actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function QuotationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const quotationId = params.id as string;
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [emailSending, setEmailSending] = useState(false);

  useEffect(() => {
    const fetchQuotation = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/sign-in";
        return;
      }

      const { data, error } = await supabase
        .from("quotations")
        .select(`
          *,
          customers(*),
          quotation_items(*)
        `)
        .eq("id", quotationId)
        .eq("user_id", user.id)
        .single();

      if (data) {
        setQuotation(data);
        setRecipientEmail(data.customers?.email || "");
      }
      setLoading(false);
    };

    if (quotationId) {
      fetchQuotation();
    }
  }, [quotationId]);

  const handleConvertToInvoice = async () => {
    if (!quotation) return;

    try {
      const result = await convertQuotationToInvoiceAction(quotation.id);

      if (result.success) {
        setQuotation({ ...quotation, status: "converted", converted_invoice_id: result.invoiceId });
        router.push(`/dashboard/invoices/${result.invoiceId}`);
      } else {
        alert("Failed to convert quotation: " + result.error);
      }
    } catch (error) {
      console.error("Error converting quotation:", error);
      alert("Error converting quotation to invoice");
    }
  };

  const handleSendEmail = async () => {
    if (!quotation || !recipientEmail) return;

    setEmailSending(true);
    try {
      const result = await sendQuotationEmailAction(quotation.id, recipientEmail);

      if (result.success) {
        setQuotation({ ...quotation, status: "sent" });
        setEmailDialogOpen(false);
        alert("Quotation sent successfully!");
      } else {
        alert("Failed to send quotation: " + result.error);
      }
    } catch (error) {
      console.error("Error sending email:", error);
      alert("Error sending quotation email");
    } finally {
      setEmailSending(false);
    }
  };

  const formatCurrency = (amount: number, currencyCode?: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode || "USD",
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusBadgeClass = (status?: string) => {
    switch (status?.toLowerCase()) {
      case "accepted":
        return "bg-green-100 text-green-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      case "sent":
        return "bg-blue-100 text-blue-800";
      case "expired":
        return "bg-gray-100 text-gray-800";
      case "converted":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-yellow-100 text-yellow-800"; // draft
    }
  };

  const isExpired = (validUntil: string) => {
    return new Date(validUntil) < new Date();
  };

  if (loading) {
    return (
      <>
        <DashboardNavbar />
        <main className="w-full">
          <div className="container mx-auto px-4 py-8">
            <div className="bg-card rounded-xl p-8 border shadow-sm flex justify-center">
              <p>Loading quotation...</p>
            </div>
          </div>
        </main>
      </>
    );
  }

  if (!quotation) {
    return (
      <>
        <DashboardNavbar />
        <main className="w-full">
          <div className="container mx-auto px-4 py-8">
            <div className="bg-card rounded-xl p-8 border shadow-sm text-center">
              <h2 className="text-2xl font-semibold mb-2">Quotation not found</h2>
              <p className="text-muted-foreground mb-4">
                The quotation you're looking for doesn't exist or you don't have permission to view it.
              </p>
              <Link href="/dashboard/quotations">
                <Button>Back to Quotations</Button>
              </Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <DashboardNavbar />
      <main className="w-full">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <Link href="/dashboard/quotations" className="mr-4">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold">Quotation {quotation.quotation_number}</h1>
                <p className="text-muted-foreground">
                  View and manage quotation details
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <form action={`/api/quotations/${quotation.id}/pdf`} method="GET">
                <Button type="submit" variant="outline">
                  <Download className="h-4 w-4 mr-2" /> Save PDF
                </Button>
              </form>
              <Link href={`/dashboard/quotations/edit/${quotation.id}`}>
                <Button variant="outline">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </Link>
              <Button
                variant="outline"
                onClick={() => setEmailDialogOpen(true)}
                disabled={quotation.status === "converted"}
              >
                <Mail className="h-4 w-4 mr-2" />
                Send Email
              </Button>
              <Button
                onClick={handleConvertToInvoice}
                disabled={quotation.status === "converted" || isExpired(quotation.valid_until)}
                className="bg-green-600 hover:bg-green-700"
              >
                <FileCheck className="h-4 w-4 mr-2" />
                Convert to Invoice
              </Button>
            </div>
          </div>

          <div className="print-area">
            <div className="bg-card rounded-xl p-6 border shadow-sm">
              {/* Quotation Header */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Quotation Details</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Quotation Number:</span>
                      <span className="font-medium">{quotation.quotation_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Issue Date:</span>
                      <span>{formatDate(quotation.issue_date)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Valid Until:</span>
                      <span className={isExpired(quotation.valid_until) ? "text-red-600" : ""}>
                        {formatDate(quotation.valid_until)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${getStatusBadgeClass(quotation.status)}`}
                      >
                        {quotation.status}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Currency:</span>
                      <span>{quotation.currency_code}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4">Customer Details</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name:</span>
                      <span className="font-medium">{quotation.customers?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Email:</span>
                      <span>{quotation.customers?.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Phone:</span>
                      <span>{quotation.customers?.phone}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Address:</span>
                      <span className="text-right max-w-xs">{quotation.customers?.address}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quotation Items */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4">Items</h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-200">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-200 px-4 py-2 text-left">Description</th>
                        <th className="border border-gray-200 px-4 py-2 text-right">Quantity</th>
                        <th className="border border-gray-200 px-4 py-2 text-right">Unit Price</th>
                        <th className="border border-gray-200 px-4 py-2 text-right">Tax Rate</th>
                        <th className="border border-gray-200 px-4 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quotation.quotation_items?.map((item, index) => (
                        <tr key={index}>
                          <td className="border border-gray-200 px-4 py-2">
                            {item.description}
                          </td>
                          <td className="border border-gray-200 px-4 py-2 text-right">
                            {item.quantity}
                          </td>
                          <td className="border border-gray-200 px-4 py-2 text-right">
                            {formatCurrency(item.unit_price, quotation.currency_code)}
                          </td>
                          <td className="border border-gray-200 px-4 py-2 text-right">
                            {item.tax_rate}%
                          </td>
                          <td className="border border-gray-200 px-4 py-2 text-right">
                            {formatCurrency(item.quantity * item.unit_price, quotation.currency_code)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  {quotation.notes && (
                    <div className="mb-4">
                      <h4 className="font-semibold mb-2">Notes</h4>
                      <p className="text-muted-foreground">{quotation.notes}</p>
                    </div>
                  )}
                  {quotation.terms_conditions && (
                    <div>
                      <h4 className="font-semibold mb-2">Terms & Conditions</h4>
                      <p className="text-muted-foreground">{quotation.terms_conditions}</p>
                    </div>
                  )}
                </div>

                <div className="bg-gray-50 p-4 rounded-md">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>{formatCurrency(quotation.subtotal, quotation.currency_code)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tax:</span>
                      <span>{formatCurrency(quotation.tax_amount, quotation.currency_code)}</span>
                    </div>
                    {quotation.discount_amount > 0 && (
                      <div className="flex justify-between">
                        <span>Discount:</span>
                        <span>-{formatCurrency(quotation.discount_amount, quotation.currency_code)}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t pt-2 font-bold text-lg">
                      <span>Total:</span>
                      <span>{formatCurrency(quotation.total_amount, quotation.currency_code)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {quotation.converted_invoice_id && (
                <div className="mt-6 p-4 bg-purple-50 border border-purple-200 rounded-md">
                  <p className="text-purple-800">
                    This quotation has been converted to an invoice.{" "}
                    <Link 
                      href={`/dashboard/invoices/${quotation.converted_invoice_id}`}
                      className="underline hover:no-underline"
                    >
                      View Invoice
                    </Link>
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Email Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Quotation</DialogTitle>
            <DialogDescription>
              Send quotation {quotation.quotation_number} to customer
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Recipient Email</Label>
              <Input
                id="email"
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="customer@example.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSendEmail} 
              disabled={emailSending || !recipientEmail}
            >
              {emailSending ? "Sending..." : "Send Quotation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}