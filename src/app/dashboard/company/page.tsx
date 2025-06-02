// app/dashboard/company/page.tsx
import DashboardNavbar from "@/components/dashboard-navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createServerSupabaseClient } from "../../../../supabase/server";
import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

export default async function CompanyProfilePage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return redirect("/sign-in");

  // TODO: Fetch existing profile from Supabase

  return (
    <>
      <DashboardNavbar />
      <main className="w-full">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold">Company Profile</h1>
              <p className="text-muted-foreground">
                Manage your business identity used in invoices
              </p>
            </div>
          </div>

          <div className="bg-card rounded-xl p-6 border shadow-sm">
            <form className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="logo">Logo</Label>
                <Input id="logo" name="logo" type="file" accept="image/*" />
                {/* TODO: Show uploaded logo preview */}
              </div>

              <div className="space-y-2">
                <Label htmlFor="company_name">Company Name</Label>
                <Input id="company_name" name="company_name" required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Textarea id="address" name="address" rows={3} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact">Contact Information</Label>
                <Input
                  id="contact"
                  name="contact"
                  placeholder="Phone / Email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment_terms">Payment Terms</Label>
                <Textarea
                  id="payment_terms"
                  name="payment_terms"
                  placeholder="e.g., Net 30, Bank Details"
                />
              </div>

              <div className="flex justify-end gap-3">
                <Link href="/dashboard">
                  <Button variant="outline" type="button">
                    Cancel
                  </Button>
                </Link>
                <Button type="submit">Save Profile</Button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </>
  );
}
