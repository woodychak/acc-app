"use client";

import DashboardNavbar from "@/components/dashboard-navbar";
import { Button } from "@/components/ui/button";
import { FileText, Plus, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { createClient } from "../../../../supabase/client";
import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState(null);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    const fetchInvoices = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/sign-in";
        return;
      }

      const { data, error } = await supabase
        .from("invoices")
        .select(
          `
          *,
          customers(name)
        `,
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (data) {
        setInvoices(data);
      }
      setLoading(false);
    };

    fetchInvoices();
  }, []);

  const handleDeleteClick = (invoice) => {
    setInvoiceToDelete(invoice);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!invoiceToDelete) return;

    const supabase = createClient();

    // First delete invoice items
    const { error: itemsError } = await supabase
      .from("invoice_items")
      .delete()
      .eq("invoice_id", invoiceToDelete.id);

    if (itemsError) {
      setDeleteError("Failed to delete invoice items");
      return;
    }

    // Then delete the invoice
    const { error } = await supabase
      .from("invoices")
      .delete()
      .eq("id", invoiceToDelete.id);

    if (error) {
      setDeleteError("Failed to delete invoice");
      return;
    }

    setInvoices(invoices.filter((i) => i.id !== invoiceToDelete.id));
    setDeleteDialogOpen(false);
    setInvoiceToDelete(null);
  };

  const formatCurrency = (amount, currencyCode) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode || "USD",
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusBadgeClass = (status) => {
    switch (status?.toLowerCase()) {
      case "paid":
        return "bg-green-100 text-green-800";
      case "overdue":
        return "bg-red-100 text-red-800";
      case "sent":
        return "bg-blue-100 text-blue-800";
      case "cancelled":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-yellow-100 text-yellow-800"; // draft
    }
  };

  return (
    <>
      <DashboardNavbar />
      <main className="w-full">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold">Invoices</h1>
              <p className="text-muted-foreground">
                Manage your customer invoices
              </p>
            </div>
            <Link href="/dashboard/invoices/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Create Invoice
              </Button>
            </Link>
          </div>

          {loading ? (
            <div className="bg-card rounded-xl p-8 border shadow-sm flex justify-center">
              <p>Loading invoices...</p>
            </div>
          ) : invoices && invoices.length > 0 ? (
            <div className="bg-card rounded-xl p-4 border shadow-sm">
              <table className="w-full table-auto text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="p-2">Invoice #</th>
                    <th className="p-2">Customer</th>
                    <th className="p-2">Date</th>
                    <th className="p-2">Due Date</th>
                    <th className="p-2">Amount</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b">
                      <td className="p-2">
                        <Link
                          href={`/dashboard/invoices/${invoice.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {invoice.invoice_number}
                        </Link>
                      </td>
                      <td className="p-2">{invoice.customers?.name}</td>
                      <td className="p-2">{formatDate(invoice.issue_date)}</td>
                      <td className="p-2">{formatDate(invoice.due_date)}</td>
                      <td className="p-2">
                        {formatCurrency(
                          invoice.total_amount,
                          invoice.currency_code,
                        )}
                      </td>
                      <td className="p-2">
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${getStatusBadgeClass(invoice.status)}`}
                        >
                          {invoice.status}
                        </span>
                      </td>
                      <td className="p-2 flex gap-2">
                        <Link href={`/dashboard/invoices/edit/${invoice.id}`}>
                          <Button size="sm" variant="outline">
                            <Pencil className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDeleteClick(invoice)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
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
                  <FileText className="h-12 w-12 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold mb-2">No invoices yet</h2>
                <p className="text-muted-foreground max-w-md mb-6">
                  Get started by creating your first invoice.
                </p>
                <Link href="/dashboard/invoices/new">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" /> Create Your First Invoice
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteError ? (
                <p className="text-red-500">{deleteError}</p>
              ) : (
                <>
                  This action cannot be undone. This will permanently delete
                  invoice <strong>{invoiceToDelete?.invoice_number}</strong>.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteError("")}>
              Cancel
            </AlertDialogCancel>
            {!deleteError && (
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
