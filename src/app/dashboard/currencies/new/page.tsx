import DashboardNavbar from "@/components/dashboard-navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../../../supabase/server";

export default async function NewCurrencyPage() {
  const supabase = await createClient();

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
            <Link href="/dashboard/currencies" className="mr-4">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Add New Currency</h1>
              <p className="text-muted-foreground">
                Configure a new currency for your accounting system
              </p>
            </div>
          </div>

          <div className="bg-card rounded-xl p-6 border shadow-sm">
            <form className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="code">Currency Code *</Label>
                  <Input
                    id="code"
                    name="code"
                    placeholder="USD"
                    maxLength={3}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    3-letter ISO code (e.g., USD, EUR, GBP)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Currency Name *</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="US Dollar"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="symbol">Symbol *</Label>
                  <Input id="symbol" name="symbol" placeholder="$" required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="decimal_places">Decimal Places</Label>
                  <Input
                    id="decimal_places"
                    name="decimal_places"
                    type="number"
                    min="0"
                    max="4"
                    defaultValue="2"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="exchange_rate">
                    Exchange Rate (to Base Currency)
                  </Label>
                  <Input
                    id="exchange_rate"
                    name="exchange_rate"
                    type="number"
                    step="0.000001"
                    min="0"
                    placeholder="1.000000"
                    defaultValue="1.000000"
                    required
                  />
                </div>

                <div className="space-y-2 flex items-center">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="is_default"
                      name="is_default"
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <Label
                      htmlFor="is_default"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Set as default currency
                    </Label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Link href="/dashboard/currencies">
                  <Button variant="outline" type="button">
                    Cancel
                  </Button>
                </Link>
                <Button type="submit">Save Currency</Button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </>
  );
}
