import DashboardNavbar from "@/components/dashboard-navbar";
import { Button } from "@/components/ui/button";
import { Globe, Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "../../../../supabase/server";
import { CurrencyManagement } from "@/components/CurrencyManagement";

export default async function CurrenciesPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  // Fetch currencies for the current user
  const { data: currencies } = await supabase
    .from("currencies")
    .select("*")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("code", { ascending: true });

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
          </div>

          <CurrencyManagement currencies={currencies || []} />
        </div>
      </main>
    </>
  );
}