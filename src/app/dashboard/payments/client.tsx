"use client";

import { Button } from "@/components/ui/button";
import { CreditCard, Plus, FileText, AlertCircle, Check } from "lucide-react";
import Link from "next/link";
import { deletePaymentAction, markInvoicePaidAction } from "./actions";
import type { InvoiceSelected, PaymentSelected } from "@/app/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";

interface PaymentsClientProps {
  unpaidInvoices: InvoiceSelected[];
  payments: PaymentSelected[];
  defaultCurrency: string;
  companyProfile: any;
}

export default function PaymentsClient({
  unpaidInvoices,
  payments,
  defaultCurrency,
  companyProfile,
}: PaymentsClientProps) {
  const [invoicePageSize, setInvoicePageSize] = useState(25);
  const [invoiceCurrentPage, setInvoiceCurrentPage] = useState(1);
  const [paymentPageSize, setPaymentPageSize] = useState(25);
  const [paymentCurrentPage, setPaymentCurrentPage] = useState(1);

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

  // Invoice pagination
  const invoiceTotalPages = Math.ceil(unpaidInvoices.length / invoicePageSize);
  const invoiceStartIndex = (invoiceCurrentPage - 1) * invoicePageSize;
  const invoiceEndIndex = invoiceStartIndex + invoicePageSize;
  const paginatedInvoices = unpaidInvoices.slice(
    invoiceStartIndex,
    invoiceEndIndex,
  );

  const handleInvoicePageSizeChange = (value: string) => {
    setInvoicePageSize(Number(value));
    setInvoiceCurrentPage(1);
  };

  const handleInvoicePageChange = (page: number) => {
    setInvoiceCurrentPage(page);
  };

  // Payment pagination
  const paymentTotalPages = Math.ceil(payments.length / paymentPageSize);
  const paymentStartIndex = (paymentCurrentPage - 1) * paymentPageSize;
  const paymentEndIndex = paymentStartIndex + paymentPageSize;
  const paginatedPayments = payments.slice(paymentStartIndex, paymentEndIndex);

  const handlePaymentPageSizeChange = (value: string) => {
    setPaymentPageSize(Number(value));
    setPaymentCurrentPage(1);
  };

  const handlePaymentPageChange = (page: number) => {
    setPaymentCurrentPage(page);
  };

  return (
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
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Unpaid Invoices</h2>
            <Select
              value={invoicePageSize.toString()}
              onValueChange={handleInvoicePageSizeChange}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">Show 25</SelectItem>
                <SelectItem value="50">Show 50</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {unpaidInvoices && unpaidInvoices.length > 0 ? (
            <div className="bg-card rounded-xl p-4 border shadow-sm">
              <div className="mb-4 flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  Showing {invoiceStartIndex + 1} to{" "}
                  {Math.min(invoiceEndIndex, unpaidInvoices.length)} of{" "}
                  {unpaidInvoices.length} invoices
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      handleInvoicePageChange(invoiceCurrentPage - 1)
                    }
                    disabled={invoiceCurrentPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="flex items-center px-3 text-sm">
                    Page {invoiceCurrentPage} of {invoiceTotalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      handleInvoicePageChange(invoiceCurrentPage + 1)
                    }
                    disabled={invoiceCurrentPage === invoiceTotalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-muted">
                      <th className="px-4 py-2 text-left w-[150px]">
                        Invoice #
                      </th>
                      <th className="px-4 py-2 text-left">Customer</th>
                      <th className="px-4 py-2 text-left">Issue Date</th>
                      <th className="px-4 py-2 text-left">Due Date</th>
                      <th className="px-4 py-2 text-left">Amount</th>
                      <th className="px-4 py-2 text-left">Status</th>
                      <th className="px-4 py-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedInvoices.map((invoice) => (
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
                        <td className="px-4 py-2">
                          {invoice?.customers?.name ?? "N/A"}
                        </td>
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
                              href={`/dashboard/invoices/${invoice.id}`}
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
            </div>
          ) : (
            <div className="bg-card rounded-xl p-6 border shadow-sm text-center">
              <p className="text-muted-foreground">No unpaid invoices found.</p>
            </div>
          )}
        </div>

        {/* Recent Payments Section */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Recent Payments</h2>
            <Select
              value={paymentPageSize.toString()}
              onValueChange={handlePaymentPageSizeChange}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">Show 25</SelectItem>
                <SelectItem value="50">Show 50</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {payments && payments.length > 0 ? (
            <div className="bg-card rounded-xl p-4 border shadow-sm">
              <div className="mb-4 flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  Showing {paymentStartIndex + 1} to{" "}
                  {Math.min(paymentEndIndex, payments.length)} of{" "}
                  {payments.length} payments
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      handlePaymentPageChange(paymentCurrentPage - 1)
                    }
                    disabled={paymentCurrentPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="flex items-center px-3 text-sm">
                    Page {paymentCurrentPage} of {paymentTotalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      handlePaymentPageChange(paymentCurrentPage + 1)
                    }
                    disabled={paymentCurrentPage === paymentTotalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-muted">
                      <th className="px-4 py-2 text-left">Date</th>
                      <th className="px-4 py-2 text-left w-[150px]">Invoice</th>
                      <th className="px-4 py-2 text-left">Customer</th>
                      <th className="px-4 py-2 text-left">Method</th>
                      <th className="px-4 py-2 text-left">Reference</th>
                      <th className="px-4 py-2 text-left">Amount</th>
                      <th className="px-4 py-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedPayments.map((payment) => (
                      <tr
                        key={payment.id}
                        className="border-b hover:bg-muted/50"
                      >
                        <td className="px-4 py-2">
                          {formatDate(payment.payment_date)}
                        </td>
                        <td className="px-4 py-2">
                          {payment.invoices ? (
                            <Link
                              href={`/dashboard/invoices/${payment.invoice_id}`}
                              className="text-primary hover:underline"
                            >
                              {payment.invoices?.invoice_number}
                            </Link>
                          ) : (
                            "N/A"
                          )}
                        </td>
                        <td className="px-4 py-2">
                          {payment.invoices?.customers?.name || "N/A"}
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
            </div>
          ) : (
            <div className="bg-card rounded-xl p-8 border shadow-sm">
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="bg-primary/10 p-4 rounded-full mb-4">
                  <CreditCard className="h-12 w-12 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold mb-2">No payments yet</h2>
                <p className="text-muted-foreground max-w-md mb-6">
                  Get started by recording your first payment.
                </p>
                <Link href="/dashboard/payments/new">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" /> Record Your First Payment
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
  );
}
