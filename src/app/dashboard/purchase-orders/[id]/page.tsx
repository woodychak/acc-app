"use client";

import DashboardNavbar from "@/components/dashboard-navbar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Edit, Download } from "lucide-react";
import Link from "next/link";
import { createClient } from "../../../../../supabase/client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PurchaseOrder } from "@/app/types";

export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const poId = params.id as string;
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPO = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/sign-in";
        return;
      }

      const { data, error } = await supabase
        .from("purchase_orders")
        .select(
          `
          *,
          vendors(*),
          customers(*),
          quotations(quotation_number),
          purchase_order_items(*, product:products(name))
        `
        )
        .eq("id", poId)
        .eq("user_id", user.id)
        .single();

      if (data) {
        setPo(data);
      }
      setLoading(false);
    };

    if (poId) {
      fetchPO();
    }
  }, [poId]);

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
      case "sent":
        return "bg-blue-100 text-blue-800";
      case "confirmed":
        return "bg-green-100 text-green-800";
      case "received":
        return "bg-purple-100 text-purple-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-yellow-100 text-yellow-800";
    }
  };

  if (loading) {
    return (
      <>
        <DashboardNavbar />
        <main className="w-full">
          <div className="container mx-auto px-4 py-8">
            <div className="bg-card rounded-xl p-8 border shadow-sm flex justify-center">
              <p>Loading purchase order...</p>
            </div>
          </div>
        </main>
      </>
    );
  }

  if (!po) {
    return (
      <>
        <DashboardNavbar />
        <main className="w-full">
          <div className="container mx-auto px-4 py-8">
            <div className="bg-card rounded-xl p-8 border shadow-sm text-center">
              <h2 className="text-2xl font-semibold mb-2">
                Purchase order not found
              </h2>
              <p className="text-muted-foreground mb-4">
                The purchase order you&apos;re looking for doesn&apos;t exist.
              </p>
              <Link href="/dashboard/purchase-orders">
                <Button>Back to Purchase Orders</Button>
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
              <Link href="/dashboard/purchase-orders" className="mr-4">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold">
                  Purchase Order {po.po_number}
                </h1>
                <p className="text-muted-foreground">
                  View and manage PO details
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <form
                action={`/api/purchase-orders/${po.id}/pdf`}
                method="GET"
              >
                <Button type="submit" variant="outline">
                  <Download className="h-4 w-4 mr-2" /> Save PDF
                </Button>
              </form>
              <Link href={`/dashboard/purchase-orders/edit/${po.id}`}>
                <Button variant="outline">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </Link>
            </div>
          </div>

          <div className="print-area">
            <div className="bg-card rounded-xl p-6 border shadow-sm">
              {/* PO Header */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div>
                  <h3 className="text-lg font-semibold mb-4">
                    Purchase Order Details
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">PO Number:</span>
                      <span className="font-medium">{po.po_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Issue Date:
                      </span>
                      <span>{formatDate(po.issue_date)}</span>
                    </div>
                    {po.expected_date && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Expected Delivery:
                        </span>
                        <span>{formatDate(po.expected_date)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${getStatusBadgeClass(po.status)}`}
                      >
                        {po.status}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Currency:</span>
                      <span>{po.currency_code}</span>
                    </div>
                    {po.quotations && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">From Quotation:</span>
                        <span>{po.quotations.quotation_number}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4">
                    Vendor Details
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name:</span>
                      <span className="font-medium">{po.vendors?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Email:</span>
                      <span>{po.vendors?.email || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Phone:</span>
                      <span>{po.vendors?.phone || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Address:</span>
                      <span className="text-right max-w-xs">
                        {po.vendors?.address || "-"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Client / Delivery Info */}
              {(po.customers || po.delivery_address) && (
                <div className="mb-8 bg-gray-50 p-4 rounded-md">
                  <h3 className="text-lg font-semibold mb-4">
                    Client & Delivery Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {po.customers && (
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Client Name:</span>
                          <span className="font-medium">{po.customers.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Email:</span>
                          <span>{po.customers.email || "-"}</span>
                        </div>
                        {po.customers.address && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Client Address:</span>
                            <span className="text-right max-w-xs">
                              {po.customers.address}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Delivery Address:</span>
                        <span className="text-right max-w-xs">
                          {po.delivery_address || po.customers?.address || "-"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Items */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4">Items</h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-200">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-200 px-4 py-2 text-left">
                          Description
                        </th>
                        <th className="border border-gray-200 px-4 py-2 text-right">
                          Quantity
                        </th>
                        <th className="border border-gray-200 px-4 py-2 text-right">
                          Unit Cost
                        </th>
                        <th className="border border-gray-200 px-4 py-2 text-right">
                          Tax Rate
                        </th>
                        <th className="border border-gray-200 px-4 py-2 text-right">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {po.purchase_order_items?.map((item, index) => (
                        <tr key={index}>
                          <td className="border border-gray-200 px-4 py-2">
                            <div className="font-medium">
                              {item.product?.name || item.description}
                            </div>
                            {item.product?.name && item.description && (
                              <div className="text-sm text-muted-foreground">
                                {item.description}
                              </div>
                            )}
                          </td>
                          <td className="border border-gray-200 px-4 py-2 text-right">
                            {item.quantity}
                          </td>
                          <td className="border border-gray-200 px-4 py-2 text-right">
                            {formatCurrency(
                              item.unit_price,
                              po.currency_code
                            )}
                          </td>
                          <td className="border border-gray-200 px-4 py-2 text-right">
                            {item.tax_rate}%
                          </td>
                          <td className="border border-gray-200 px-4 py-2 text-right">
                            {formatCurrency(
                              item.quantity * item.unit_price,
                              po.currency_code
                            )}
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
                  {po.notes && (
                    <div className="mb-4">
                      <h4 className="font-semibold mb-2">Notes</h4>
                      <p className="text-muted-foreground">{po.notes}</p>
                    </div>
                  )}
                  {po.terms_conditions && (
                    <div>
                      <h4 className="font-semibold mb-2">
                        Terms & Conditions
                      </h4>
                      <p className="text-muted-foreground">
                        {po.terms_conditions}
                      </p>
                    </div>
                  )}
                </div>

                <div className="bg-gray-50 p-4 rounded-md">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>
                        {formatCurrency(po.subtotal, po.currency_code)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tax:</span>
                      <span>
                        {formatCurrency(po.tax_amount, po.currency_code)}
                      </span>
                    </div>
                    {po.discount_amount > 0 && (
                      <div className="flex justify-between">
                        <span>Discount:</span>
                        <span>
                          -
                          {formatCurrency(
                            po.discount_amount,
                            po.currency_code
                          )}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between border-t pt-2 font-bold text-lg">
                      <span>Total:</span>
                      <span>
                        {formatCurrency(po.total_amount, po.currency_code)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
