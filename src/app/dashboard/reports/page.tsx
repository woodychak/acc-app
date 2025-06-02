import DashboardNavbar from "@/components/dashboard-navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, LineChart, PieChart } from "lucide-react";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "../../../../supabase/server";

export default async function ReportsPage() {
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
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold">Financial Reports</h1>
              <p className="text-muted-foreground">
                View and analyze your financial data
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Revenue Analysis</CardTitle>
                <LineChart className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="bg-primary/10 p-4 rounded-full mb-4">
                    <LineChart className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">No revenue data</h3>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Start creating invoices and recording payments to see your
                    revenue analysis.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Expense Breakdown</CardTitle>
                <PieChart className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="bg-primary/10 p-4 rounded-full mb-4">
                    <PieChart className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">No expense data</h3>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Start recording expenses to see your expense breakdown by
                    category.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Cash Flow</CardTitle>
                <BarChart3 className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="bg-primary/10 p-4 rounded-full mb-4">
                    <BarChart3 className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">
                    No cash flow data
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Start recording income and expenses to see your cash flow
                    analysis.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="bg-card rounded-xl p-8 border shadow-sm">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="bg-primary/10 p-4 rounded-full mb-4">
                <BarChart3 className="h-12 w-12 text-primary" />
              </div>
              <h2 className="text-2xl font-semibold mb-2">
                No financial data available
              </h2>
              <p className="text-muted-foreground max-w-md mb-6">
                Start recording transactions to generate detailed financial
                reports and visualizations.
              </p>
              <div className="flex flex-wrap gap-4 justify-center">
                <Button variant="outline">Generate Revenue Report</Button>
                <Button variant="outline">Generate Expense Report</Button>
                <Button variant="outline">Generate Cash Flow Report</Button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
