import DashboardNavbar from "@/components/dashboard-navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "../../../../../../supabase/server";
import { updateVendorAction } from "../../actions";

export default async function EditVendorPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  const { data: vendor, error } = await supabase
    .from("vendors")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !vendor) {
    return redirect("/dashboard/vendors");
  }

  return (
    <>
      <DashboardNavbar />
      <main className="w-full">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center mb-6">
            <Link href="/dashboard/vendors" className="mr-4">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Edit Vendor</h1>
              <p className="text-muted-foreground">
                Update vendor information
              </p>
            </div>
          </div>

          <div className="bg-card rounded-xl p-6 border shadow-sm">
            <form action={updateVendorAction} className="space-y-6">
              <input type="hidden" name="id" value={vendor.id} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Vendor Name *</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="Enter vendor name"
                    defaultValue={vendor.name}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contact_person">Contact Person</Label>
                  <Input
                    id="contact_person"
                    name="contact_person"
                    placeholder="Contact person name"
                    defaultValue={vendor.contact_person || ""}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="vendor@example.com"
                    defaultValue={vendor.email || ""}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    name="phone"
                    placeholder="Phone number"
                    defaultValue={vendor.phone || ""}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    name="address"
                    placeholder="Street address"
                    defaultValue={vendor.address || ""}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    name="city"
                    placeholder="City"
                    defaultValue={vendor.city || ""}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="state">State/Province</Label>
                  <Input
                    id="state"
                    name="state"
                    placeholder="State"
                    defaultValue={vendor.state || ""}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="postal_code">Postal Code</Label>
                  <Input
                    id="postal_code"
                    name="postal_code"
                    placeholder="Postal code"
                    defaultValue={vendor.postal_code || ""}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    name="country"
                    placeholder="Country"
                    defaultValue={vendor.country || ""}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tax_id">Tax ID</Label>
                  <Input
                    id="tax_id"
                    name="tax_id"
                    placeholder="Tax identification number"
                    defaultValue={vendor.tax_id || ""}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="is_active">Status</Label>
                  <select
                    id="is_active"
                    name="is_active"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    defaultValue={vendor.is_active ? "true" : "false"}
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    name="notes"
                    placeholder="Additional notes about this vendor"
                    rows={3}
                    defaultValue={vendor.notes || ""}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Link href="/dashboard/vendors">
                  <Button variant="outline" type="button">
                    Cancel
                  </Button>
                </Link>
                <Button type="submit">Update Vendor</Button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </>
  );
}
