import DashboardNavbar from "@/components/dashboard-navbar";
import { Button } from "@/components/ui/button";
import { Globe, Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../../supabase/server";

export default async function CurrenciesPage() {
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
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold">Currency Settings</h1>
              <p className="text-muted-foreground">
                Manage currencies and exchange rates
              </p>
            </div>
            <Link href="/dashboard/currencies/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Add Currency
              </Button>
            </Link>
          </div>

          <div className="bg-card rounded-xl p-8 border shadow-sm">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="bg-primary/10 p-4 rounded-full mb-4">
                <Globe className="h-12 w-12 text-primary" />
              </div>
              <h2 className="text-2xl font-semibold mb-2">
                No currencies configured
              </h2>
              <p className="text-muted-foreground max-w-md mb-6">
                Get started by adding your first currency to enable
                multi-currency support.
              </p>
              <Link href="/dashboard/currencies/new">
                <Button>
                  <Plus className="mr-2 h-4 w-4" /> Add Your First Currency
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
