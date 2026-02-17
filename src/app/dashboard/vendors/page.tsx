"use client";

import DashboardNavbar from "@/components/dashboard-navbar";
import { Button } from "@/components/ui/button";
import { Truck, Plus, Pencil, Trash2 } from "lucide-react";
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
import { Vendor } from "@/app/types";
import { deleteVendorAction } from "./actions";

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [vendorToDelete, setVendorToDelete] = useState<Vendor | null>(null);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    const fetchVendors = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/sign-in";
        return;
      }

      const { data, error } = await supabase
        .from("vendors")
        .select("*")
        .eq("user_id", user.id)
        .order("name", { ascending: true });

      if (data) {
        setVendors(data);
      }
      setLoading(false);
    };

    fetchVendors();
  }, []);

  const handleDeleteClick = (vendor: Vendor) => {
    setVendorToDelete(vendor);
    setDeleteDialogOpen(true);
    setDeleteError("");
  };

  const handleDeleteConfirm = async () => {
    if (!vendorToDelete) return;

    const result = await deleteVendorAction(vendorToDelete.id);

    if (result.success) {
      setVendors(vendors.filter((v) => v.id !== vendorToDelete.id));
      setDeleteDialogOpen(false);
      setVendorToDelete(null);
    } else {
      setDeleteError(result.message || "Failed to delete vendor");
    }
  };

  return (
    <>
      <DashboardNavbar />
      <main className="w-full">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold">Vendors</h1>
              <p className="text-muted-foreground">
                Manage your suppliers and vendors
              </p>
            </div>
            <Link href="/dashboard/vendors/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Add Vendor
              </Button>
            </Link>
          </div>

          {loading ? (
            <div className="bg-card rounded-xl p-8 border shadow-sm flex justify-center">
              <p>Loading vendors...</p>
            </div>
          ) : vendors && vendors.length > 0 ? (
            <div className="bg-card rounded-xl p-4 border shadow-sm">
              <table className="w-full table-auto text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="p-2">Name</th>
                    <th className="p-2">Contact Person</th>
                    <th className="p-2">Email</th>
                    <th className="p-2">Phone</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map((vendor) => (
                    <tr key={vendor.id} className="border-b">
                      <td className="p-2 font-medium">{vendor.name}</td>
                      <td className="p-2">{vendor.contact_person || "-"}</td>
                      <td className="p-2">{vendor.email || "-"}</td>
                      <td className="p-2">{vendor.phone || "-"}</td>
                      <td className="p-2">
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${
                            vendor.is_active
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {vendor.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="p-2 flex gap-2">
                        <Link href={`/dashboard/vendors/edit/${vendor.id}`}>
                          <Button size="sm" variant="outline">
                            <Pencil className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDeleteClick(vendor)}
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
                  <Truck className="h-12 w-12 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold mb-2">No vendors yet</h2>
                <p className="text-muted-foreground max-w-md mb-6">
                  Add your first vendor to start creating purchase orders.
                </p>
                <Link href="/dashboard/vendors/new">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" /> Add Your First Vendor
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
                  vendor <strong>{vendorToDelete?.name}</strong>.
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
