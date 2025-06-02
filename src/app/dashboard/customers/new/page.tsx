import DashboardNavbar from "@/components/dashboard-navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "../../../../../supabase/server";
import { createCustomerAction } from "../../../actions";

export default async function NewCustomerPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  return (
    <>
      <DashboardNavbar />
      <main className="w-full">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center mb-6">
            <Link href="/dashboard/customers" className="mr-4">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Add New Customer</h1>
              <p className="text-muted-foreground">
                Create a new customer record
              </p>
            </div>
          </div>

          <div className="bg-card rounded-xl p-6 border shadow-sm">
            <form action={createCustomerAction} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Customer Name *</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="Enter customer name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="customer@example.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    name="phone"
                    placeholder="Enter phone number"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tax_id">Tax ID / VAT Number</Label>
                  <Input id="tax_id" name="tax_id" placeholder="Enter tax ID" />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    name="address"
                    placeholder="Street address"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" name="city" placeholder="City" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="state">State / Province</Label>
                  <Input
                    id="state"
                    name="state"
                    placeholder="State or province"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="postal_code">Postal Code</Label>
                  <Input
                    id="postal_code"
                    name="postal_code"
                    placeholder="Postal code"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input id="country" name="country" placeholder="Country" />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    name="notes"
                    placeholder="Additional notes about this customer"
                    rows={4}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Link href="/dashboard/customers">
                  <Button variant="outline" type="button">
                    Cancel
                  </Button>
                </Link>
                <Button type="submit">Save Customer</Button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </>
  );
}
