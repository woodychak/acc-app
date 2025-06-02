import DashboardNavbar from "@/components/dashboard-navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "../../../../../../supabase/server";
import { updateProductAction } from "../../actions";

export default async function EditProductPage({
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

  // Get product data
  const { data: product, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !product) {
    return redirect("/dashboard/products");
  }

  // Get company profile to get default currency
  const { data: companyProfile } = await supabase
    .from("company_profile")
    .select("default_currency")
    .single();

  const defaultCurrency = companyProfile?.default_currency || "HKD";

  return (
    <>
      <DashboardNavbar />
      <main className="w-full">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center mb-6">
            <Link href="/dashboard/products" className="mr-4">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Edit Product</h1>
              <p className="text-muted-foreground">
                Update product information
              </p>
            </div>
          </div>

          <div className="bg-card rounded-xl p-6 border shadow-sm">
            <form action={updateProductAction} className="space-y-6">
              <input type="hidden" name="id" value={product.id} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Product Name *</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="Enter product name"
                    defaultValue={product.name}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sku">SKU</Label>
                  <Input
                    id="sku"
                    name="sku"
                    placeholder="Enter product SKU"
                    defaultValue={product.sku || ""}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="price">Price *</Label>
                  <Input
                    id="price"
                    name="price"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    defaultValue={product.price}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <select
                    id="currency"
                    name="currency"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    defaultValue={product.currency_code || defaultCurrency}
                  >
                    <option value="HKD">HKD - Hong Kong Dollar</option>
                    <option value="USD">USD - US Dollar</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="GBP">GBP - British Pound</option>
                    <option value="JPY">JPY - Japanese Yen</option>
                    <option value="CNY">CNY - Chinese Yuan</option>
                    <option value="CAD">CAD - Canadian Dollar</option>
                    <option value="AUD">AUD - Australian Dollar</option>
                    <option value="SGD">SGD - Singapore Dollar</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tax_rate">Tax Rate (%)</Label>
                  <Input
                    id="tax_rate"
                    name="tax_rate"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    defaultValue={product.tax_rate || ""}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="is_active">Status</Label>
                  <select
                    id="is_active"
                    name="is_active"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    defaultValue={product.is_active ? "true" : "false"}
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="Enter product description"
                    rows={4}
                    defaultValue={product.description || ""}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Link href="/dashboard/products">
                  <Button variant="outline" type="button">
                    Cancel
                  </Button>
                </Link>
                <Button type="submit">Update Product</Button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </>
  );
}
