import DashboardNavbar from "@/components/dashboard-navbar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Send, Printer } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "../../../../../supabase/server";
import Image from "next/image";
import PrintButton from "@/components/PrintButton";

export default async function InvoiceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  // Get invoice with related data
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select(
      `
      *,
      customers(*),
      invoice_items(*, product:products(name))
    `,
    )
    .eq("id", params.id)
    .single();

  if (invoiceError || !invoice) {
    return (
      <>
        <DashboardNavbar />
        <main className="w-full">
          <div className="container mx-auto px-4 py-8">
            <div className="flex items-center mb-6">
              <Link href="/dashboard/invoices" className="mr-4">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <h1 className="text-3xl font-bold">Invoice Not Found</h1>
            </div>
            <div className="bg-card rounded-xl p-6 border shadow-sm">
              <p>The requested invoice could not be found.</p>
              <Link href="/dashboard/invoices">
                <Button className="mt-4">Back to Invoices</Button>
              </Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  // Get company profile
  const { data: companyProfile, error: profileError } = await supabase
    .from("company_profile")
    .select("*")
    .limit(1)
    .single();

  if (profileError) {
    console.error("Error fetching company profile:", profileError);
  }

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: invoice.currency_code || "USD",
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "paid":
        return "bg-green-100 text-green-800";
      case "overdue":
        return "bg-red-100 text-red-800";
      case "sent":
        return "bg-blue-100 text-blue-800";
      case "cancelled":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-yellow-100 text-yellow-800";
    }
  };

  return (
    <>
      <DashboardNavbar />
      <main className="w-full">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <Link href="/dashboard/invoices" className="mr-4">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold">
                  Invoice {invoice.invoice_number}
                </h1>
                
                <p className="text-muted-foreground">
                  {formatDate(invoice.issue_date)}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <form action={`/api/invoices/${params.id}/pdf`} method="GET">
                <Button type="submit" variant="outline">
                  <Download className="h-4 w-4 mr-2" /> Save PDF
                </Button>
              </form>
              
                <PrintButton />
              
              <Button>
                <Send className="h-4 w-4 mr-2" /> Send to Customer
              </Button>
            </div>
          </div>
          <div className="print-area">

          <div className="bg-white rounded-xl p-8 border shadow-sm print:shadow-none">
            {/* Invoice Header */}
            <div className="flex justify-between mb-8">
              <div>
                <div className="mb-4">
                  <Image
                    src={
                      companyProfile?.logo_url ||
                      `https://api.dicebear.com/7.x/initials/png?seed=${encodeURIComponent(companyProfile?.name || "Company")}`
                    }
                    alt="Company Logo"
                    width={150}
                    height={60}
                    className="object-contain"
                  />
                </div>
                <h2 className="text-xl font-bold">
                  {companyProfile?.name || "Your Company"}
                </h2>
                <p className="whitespace-pre-line">
                  {companyProfile?.address || ""}
                </p>
                <p>{companyProfile?.tel || ""}</p>
              </div>
              <div className="text-right">
                <h1 className="text-2xl font-bold mb-2">INVOICE</h1>
                <p className="text-lg font-semibold">
                  {invoice.invoice_number}
                </p>
                <div
                  className={`inline-block px-2 py-1 rounded-md text-xs font-medium mt-2 ${getStatusColor(
                    invoice.status,
                  )}`}
                >
                  {invoice.status.toUpperCase()}
                </div>
              </div>
            </div>

            {/* Bill To / Invoice Details */}
            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="text-sm font-semibold text-gray-500 mb-2">
                  BILL TO
                </h3>
                <p className="font-bold">{invoice.customers?.name}</p>
                <p>{invoice.customers?.address || ""}</p>
                {invoice.customers?.city && (
                  <p>
                    {invoice.customers.city}, {invoice.customers.state}{" "}
                    {invoice.customers.postal_code}
                  </p>
                )}
                {invoice.customers?.country && (
                  <p>{invoice.customers.country}</p>
                )}
                {invoice.customers?.email && <p>{invoice.customers.email}</p>}
                {invoice.customers?.phone && <p>{invoice.customers.phone}</p>}
              </div>
              <div className="text-right">
                <div className="space-y-1">
                  <div className="grid grid-cols-2">
                    <span className="text-gray-500">Issue Date:</span>
                    <span>{formatDate(invoice.issue_date)}</span>
                  </div>
                  <div className="grid grid-cols-2">
                    <span className="text-gray-500">Due Date:</span>
                    <span>{formatDate(invoice.due_date)}</span>
                  </div>
                  <div className="grid grid-cols-2">
                    <span className="text-gray-500">Currency:</span>
                    <span>{invoice.currency_code}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Invoice Items */}
            <div className="mb-8">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Item
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Quantity
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Unit Price
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Tax
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {invoice.invoice_items.map((item: any) => (
                    <tr key={item.id}>
                       <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {item.product?.name || "Unnamed Product"}
                        </div>
                        {(item.product?.description || item.description) && (
                          <div className="text-xs text-gray-500 mt-1">
                            {item.product?.description || item.description}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.quantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatCurrency(item.unit_price)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.tax_rate}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {formatCurrency(item.line_total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Invoice Summary */}
            <div className="flex justify-end mb-8">
              <div className="w-80">
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Subtotal:</span>
                    <span>{formatCurrency(invoice.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Tax:</span>
                    <span>{formatCurrency(invoice.tax_amount)}</span>
                  </div>
                  {invoice.discount_amount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Discount:</span>
                      <span>-{formatCurrency(invoice.discount_amount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-2 font-bold">
                    <span>Total:</span>
                    <span>{formatCurrency(invoice.total_amount)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            {invoice.notes && (
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-500 mb-2">
                  NOTES
                </h3>
                <p className="text-sm text-gray-600 whitespace-pre-line">
                  {invoice.notes}
                </p>
              </div>
            )}

            {/* Payment Terms */}
            {companyProfile?.payment_terms && (
              <div className="border-t mt-4 pt-4">
                <h3 className="text-sm font-semibold text-gray-500 mb-2">
                  PAYMENT TERMS
                </h3>
                <p className="text-sm text-gray-600 whitespace-pre-line">
                  {companyProfile.payment_terms}
                </p>
              </div>
            )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
