"use client";

import DashboardNavbar from "@/components/dashboard-navbar";
import { Button } from "@/components/ui/button";
import { FileText, Plus, Pencil, Trash2, Mail, FileCheck } from "lucide-react";
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
import { Quotation } from "@/app/types";
import { duplicateQuotationAction, convertQuotationToInvoiceAction, sendQuotationEmailAction } from "./actions";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function QuotationsPage() {
  const router = useRouter();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [quotationToDelete, setQuotationToDelete] = useState<Quotation | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchQuotations = async () => {
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
          customers(name, email)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (data) {
        setQuotations(data);
      }
      setLoading(false);
    };

    fetchQuotations();
  }, []);

  const handleDeleteClick = (quotation: Quotation) => {
    setQuotationToDelete(quotation);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!quotationToDelete) return;

    const supabase = createClient();

    // First delete quotation items
    const { error: itemsError } = await supabase
      .from("quotation_items")
      .delete()
      .eq("quotation_id", quotationToDelete.id);

    if (itemsError) {
      setDeleteError("Failed to delete quotation items");
      return;
    }

    // Then delete the quotation
    const { error } = await supabase
      .from("quotations")
      .delete()
      .eq("id", quotationToDelete.id);

    if (error) {
      setDeleteError("Failed to delete quotation");
      return;
    }

    setQuotations(quotations.filter((q) => q.id !== quotationToDelete.id));
    setDeleteDialogOpen(false);
    setQuotationToDelete(null);
  };

  const handleDuplicateClick = async (quotation: Quotation) => {
    try {
      const result = await duplicateQuotationAction(quotation.id);

      if (result.success && result.quotationData) {
        sessionStorage.setItem(
          "duplicateQuotationData",
          JSON.stringify(result.quotationData),
        );
        router.push("/dashboard/quotations/new");
      } else {
        console.error("Failed to duplicate quotation:", result.error);
      }
    } catch (error) {
      console.error("Error duplicating quotation:", error);
    }
  };

  const handleConvertToInvoice = async (quotation: Quotation) => {
    try {
      const result = await convertQuotationToInvoiceAction(quotation.id);

      if (result.success) {
        // Update the quotation status locally
        setQuotations(quotations.map(q => 
          q.id === quotation.id 
            ? { ...q, status: "converted", converted_invoice_id: result.invoiceId }
            : q
        ));
        
        // Optionally redirect to the new invoice
        router.push(`/dashboard/invoices/${result.invoiceId}`);
      } else {
        console.error("Failed to convert quotation:", result.error);
        alert("Failed to convert quotation to invoice: " + result.error);
      }
    } catch (error) {
      console.error("Error converting quotation:", error);
      alert("Error converting quotation to invoice");
    }
  };

  const handleEmailClick = (quotation: Quotation) => {
    setSelectedQuotation(quotation);
    setRecipientEmail(quotation.customers?.email || "");
    setEmailDialogOpen(true);
  };

  const handleSendEmail = async () => {
    if (!selectedQuotation || !recipientEmail) return;

    setEmailSending(true);
    try {
      const result = await sendQuotationEmailAction(selectedQuotation.id, recipientEmail);

      if (result.success) {
        // Update quotation status locally
        setQuotations(quotations.map(q => 
          q.id === selectedQuotation.id 
            ? { ...q, status: "sent" }
            : q
        ));
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

  // Pagination logic
  const totalPages = Math.ceil(quotations.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedQuotations = quotations.slice(startIndex, endIndex);

  const handlePageSizeChange = (value: string) => {
    setPageSize(Number(value));
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <>
      <DashboardNavbar />
      <main className="w-full">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold">Quotations</h1>
              <p className="text-muted-foreground">
                Manage your customer quotations
              </p>
            </div>
            <div className="flex gap-2 items-center">
              <Select
                value={pageSize.toString()}
                onValueChange={handlePageSizeChange}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">Show 25</SelectItem>
                  <SelectItem value="50">Show 50</SelectItem>
                </SelectContent>
              </Select>
              <Link href="/dashboard/quotations/new">
                <Button>
                  <Plus className="mr-2 h-4 w-4" /> Create Quotation
                </Button>
              </Link>
            </div>
          </div>

          {loading ? (
            <div className="bg-card rounded-xl p-8 border shadow-sm flex justify-center">
              <p>Loading quotations...</p>
            </div>
          ) : quotations && quotations.length > 0 ? (
            <div className="bg-card rounded-xl p-4 border shadow-sm">
              <div className="mb-4 flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  Showing {startIndex + 1} to{" "}
                  {Math.min(endIndex, quotations.length)} of {quotations.length}{" "}
                  quotations
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="flex items-center px-3 text-sm">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
              <table className="w-full table-auto text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="p-2">Quotation #</th>
                    <th className="p-2">Customer</th>
                    <th className="p-2">Issue Date</th>
                    <th className="p-2">Valid Until</th>
                    <th className="p-2">Amount</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedQuotations.map((quotation) => (
                    <tr key={quotation.id} className="border-b">
                      <td className="p-2">
                        <Link
                          href={`/dashboard/quotations/${quotation.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {quotation.quotation_number}
                        </Link>
                      </td>
                      <td className="p-2">{quotation.customers?.name}</td>
                      <td className="p-2">{formatDate(quotation.issue_date)}</td>
                      <td className="p-2">
                        <span className={isExpired(quotation.valid_until) ? "text-red-600" : ""}>
                          {formatDate(quotation.valid_until)}
                        </span>
                      </td>
                      <td className="p-2">
                        {formatCurrency(
                          quotation.total_amount,
                          quotation.currency_code,
                        )}
                      </td>
                      <td className="p-2">
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${getStatusBadgeClass(quotation.status)}`}
                        >
                          {quotation.status}
                        </span>
                      </td>
                      <td className="p-2 flex gap-2">
                        <Link href={`/dashboard/quotations/edit/${quotation.id}`}>
                          <Button size="sm" variant="outline">
                            <Pencil className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEmailClick(quotation)}
                          disabled={quotation.status === "converted"}
                        >
                          <Mail className="h-4 w-4 mr-1" />
                          Send
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleConvertToInvoice(quotation)}
                          disabled={quotation.status === "converted" || isExpired(quotation.valid_until)}
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        >
                          <FileCheck className="h-4 w-4 mr-1" />
                          Convert
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDuplicateClick(quotation)}
                        >
                          <FileText className="h-4 w-4 mr-1" />
                          Duplicate
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDeleteClick(quotation)}
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
                <h2 className="text-2xl font-semibold mb-2">No quotations yet</h2>
                <p className="text-muted-foreground max-w-md mb-6">
                  Get started by creating your first quotation.
                </p>
                <Link href="/dashboard/quotations/new">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" /> Create Your First Quotation
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Delete Dialog */}
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
                  quotation <strong>{quotationToDelete?.quotation_number}</strong>.
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

      {/* Email Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Quotation</DialogTitle>
            <DialogDescription>
              Send quotation {selectedQuotation?.quotation_number} to customer
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