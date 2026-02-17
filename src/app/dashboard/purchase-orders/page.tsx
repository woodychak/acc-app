"use client";

import DashboardNavbar from "@/components/dashboard-navbar";
import { Button } from "@/components/ui/button";
import { ClipboardList, Plus, Pencil, Trash2, Download } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PurchaseOrder } from "@/app/types";
import { deletePurchaseOrderAction } from "./actions";
import { useRouter } from "next/navigation";

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [poToDelete, setPoToDelete] = useState<PurchaseOrder | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchPOs = async () => {
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
        .select(`
          *,
          vendors(name, email),
          customers(name, address)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (data) {
        setPurchaseOrders(data);
      }
      setLoading(false);
    };

    fetchPOs();
  }, []);

  const handleDeleteClick = (po: PurchaseOrder) => {
    setPoToDelete(po);
    setDeleteDialogOpen(true);
    setDeleteError("");
  };

  const handleDeleteConfirm = async () => {
    if (!poToDelete) return;

    const result = await deletePurchaseOrderAction(poToDelete.id);

    if (result.success) {
      setPurchaseOrders(purchaseOrders.filter((p) => p.id !== poToDelete.id));
      setDeleteDialogOpen(false);
      setPoToDelete(null);
    } else {
      setDeleteError(result.error || "Failed to delete purchase order");
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
      case "sent":
        return "bg-blue-100 text-blue-800";
      case "confirmed":
        return "bg-green-100 text-green-800";
      case "received":
        return "bg-purple-100 text-purple-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-yellow-100 text-yellow-800"; // draft
    }
  };

  // Pagination
  const totalPages = Math.ceil(purchaseOrders.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedPOs = purchaseOrders.slice(startIndex, endIndex);

  return (
    <>
      <DashboardNavbar />
      <main className="w-full">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold">Purchase Orders</h1>
              <p className="text-muted-foreground">
                Manage your purchase orders to vendors
              </p>
            </div>
            <div className="flex gap-2 items-center">
              <Select
                value={pageSize.toString()}
                onValueChange={(v) => {
                  setPageSize(Number(v));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">Show 25</SelectItem>
                  <SelectItem value="50">Show 50</SelectItem>
                </SelectContent>
              </Select>
              <Link href="/dashboard/purchase-orders/new">
                <Button>
                  <Plus className="mr-2 h-4 w-4" /> Create PO
                </Button>
              </Link>
            </div>
          </div>

          {loading ? (
            <div className="bg-card rounded-xl p-8 border shadow-sm flex justify-center">
              <p>Loading purchase orders...</p>
            </div>
          ) : purchaseOrders && purchaseOrders.length > 0 ? (
            <div className="bg-card rounded-xl p-4 border shadow-sm">
              <div className="mb-4 flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  Showing {startIndex + 1} to{" "}
                  {Math.min(endIndex, purchaseOrders.length)} of{" "}
                  {purchaseOrders.length} purchase orders
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage - 1)}
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
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
              <table className="w-full table-auto text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="p-2">PO #</th>
                    <th className="p-2">Vendor</th>
                    <th className="p-2">Client</th>
                    <th className="p-2">Issue Date</th>
                    <th className="p-2">Expected Date</th>
                    <th className="p-2">Amount</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPOs.map((po) => (
                    <tr key={po.id} className="border-b">
                      <td className="p-2">
                        <Link
                          href={`/dashboard/purchase-orders/${po.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {po.po_number}
                        </Link>
                      </td>
                      <td className="p-2">{po.vendors?.name}</td>
                      <td className="p-2">{po.customers?.name || "-"}</td>
                      <td className="p-2">{formatDate(po.issue_date)}</td>
                      <td className="p-2">
                        {po.expected_date ? formatDate(po.expected_date) : "-"}
                      </td>
                      <td className="p-2">
                        {formatCurrency(po.total_amount, po.currency_code)}
                      </td>
                      <td className="p-2">
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${getStatusBadgeClass(po.status)}`}
                        >
                          {po.status}
                        </span>
                      </td>
                      <td className="p-2 flex gap-2">
                        <Link href={`/dashboard/purchase-orders/${po.id}`}>
                          <Button size="sm" variant="outline">
                            <Download className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </Link>
                        <Link href={`/dashboard/purchase-orders/edit/${po.id}`}>
                          <Button size="sm" variant="outline">
                            <Pencil className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDeleteClick(po)}
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
                  <ClipboardList className="h-12 w-12 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold mb-2">
                  No purchase orders yet
                </h2>
                <p className="text-muted-foreground max-w-md mb-6">
                  Create your first purchase order to your vendors.
                </p>
                <Link href="/dashboard/purchase-orders/new">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" /> Create Your First PO
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
                  purchase order <strong>{poToDelete?.po_number}</strong>.
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
