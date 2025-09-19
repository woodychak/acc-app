import DashboardNavbar from "@/components/dashboard-navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart3,
  CreditCard,
  DollarSign,
  FileText,
  Globe,
  InfoIcon,
  Package2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "../../../supabase/server";
import { getDashboardData } from "./actions";
import DashboardCharts from "@/components/DashboardCharts";

export default async function Dashboard() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  const dashboardData = await getDashboardData();

  const formatCurrency = (amount: number, currency?: string) => {
    const currencyCode = currency || dashboardData.defaultCurrency;
    const symbol = dashboardData.currencySymbols[currencyCode] || currencyCode;
    return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatMultiCurrency = (currencyAmounts: Record<string, number>) => {
    const entries = Object.entries(currencyAmounts);
    if (entries.length === 0) return formatCurrency(0);
    if (entries.length === 1) {
      const [currency, amount] = entries[0];
      return formatCurrency(amount, currency);
    }
    return entries
      .map(([currency, amount]) => formatCurrency(amount, currency))
      .join(" + ");
  };

  // Dashboard modules
  const modules = [
    {
      title: "Products",
      description: "Manage your product catalog",
      icon: <Package2 className="h-8 w-8" />,
      href: "/dashboard/products",
      color: "bg-blue-100 text-blue-700",
    },
    {
      title: "Customers",
      description: "Manage your customer database",
      icon: <Users className="h-8 w-8" />,
      href: "/dashboard/customers",
      color: "bg-green-100 text-green-700",
    },
    {
      title: "Invoices",
      description: "Create and manage invoices",
      icon: <FileText className="h-8 w-8" />,
      href: "/dashboard/invoices",
      color: "bg-purple-100 text-purple-700",
    },
    {
      title: "Payments",
      description: "Track and record payments",
      icon: <CreditCard className="h-8 w-8" />,
      href: "/dashboard/payments",
      color: "bg-amber-100 text-amber-700",
    },
    {
      title: "Currency Settings",
      description: "Configure multi-currency support",
      icon: <Globe className="h-8 w-8" />,
      href: "/dashboard/currencies",
      color: "bg-cyan-100 text-cyan-700",
    },
    {
      title: "Financial Reports",
      description: "View financial analytics",
      icon: <BarChart3 className="h-8 w-8" />,
      href: "/dashboard/reports",
      color: "bg-rose-100 text-rose-700",
    },
  ];

  // Prepare chart data for revenue by month
  const chartMonths = Object.keys(dashboardData.revenueByMonth).slice(-6); // Last 6 months
  const hasRevenueData = Object.keys(dashboardData.revenueByCurrency).length > 0;
  const hasOutstandingData = Object.keys(dashboardData.outstandingByCurrency).length > 0;

  // Prepare data for pie charts
  const revenueChartData = Object.entries(dashboardData.revenueByCurrency).map(([currency, amount]) => ({
    name: currency,
    value: amount,
    formattedValue: formatCurrency(amount, currency)
  }));

  const outstandingChartData = Object.entries(dashboardData.outstandingByCurrency).map(([currency, amount]) => ({
    name: currency,
    value: amount,
    formattedValue: formatCurrency(amount, currency)
  }));

  return (
    <>
      <DashboardNavbar />
      <main className="w-full">
        <div className="container mx-auto px-4 py-8 flex flex-col gap-8">
          {/* Header Section */}
          <header className="flex flex-col gap-4">
            <h1 className="text-3xl font-bold">Financial Dashboard</h1>
            <div className="bg-secondary/50 text-sm p-3 px-4 rounded-lg text-muted-foreground flex gap-2 items-center">
              <InfoIcon size="14" />
              <span>Welcome to your multi-currency accounting dashboard</span>
            </div>
          </header>

          {/* Financial Overview */}
          <section>
            <h2 className="text-xl font-semibold mb-4">Financial Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Revenue
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {formatMultiCurrency(dashboardData.revenueByCurrency)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {dashboardData.totalRevenue > 0
                      ? "From recorded payments"
                      : "No revenue recorded yet"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">
                    Outstanding
                  </CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber-600">
                    {formatMultiCurrency(dashboardData.outstandingByCurrency)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {dashboardData.totalOutstanding > 0
                      ? "From unpaid invoices"
                      : "No outstanding invoices"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Customers
                  </CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">
                    {dashboardData.totalCustomers}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {dashboardData.totalCustomers > 0
                      ? "Active customers"
                      : "No customers added yet"}
                  </p>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Charts Section */}
          {(hasRevenueData || hasOutstandingData) && (
            <section>
              <h2 className="text-xl font-semibold mb-4">Financial Charts</h2>
              <DashboardCharts
                revenueChartData={revenueChartData}
                outstandingChartData={outstandingChartData}
                hasRevenueData={hasRevenueData}
                hasOutstandingData={hasOutstandingData}
              />

              {/* Monthly Revenue Trend - keeping as bar chart since it shows time series data */}
              {chartMonths.length > 0 && (
                <Card className="mt-6">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Revenue Trend (Last 6 Months)</CardTitle>
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      {chartMonths.map((month) => {
                        const monthData = dashboardData.revenueByMonth[month] || {};
                        const monthTotal = Object.values(monthData).reduce((sum, amount) => sum + amount, 0);
                        const maxMonthTotal = Math.max(...chartMonths.map(m => 
                          Object.values(dashboardData.revenueByMonth[m] || {}).reduce((sum, amount) => sum + amount, 0)
                        ));
                        const percentage = maxMonthTotal > 0 ? (monthTotal / maxMonthTotal) * 100 : 0;

                        return (
                          <div key={month} className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium">{month}</span>
                              <div className="text-sm text-blue-600 font-medium">
                                {Object.entries(monthData).map(([currency, amount]) => 
                                  formatCurrency(amount, currency)
                                ).join(" + ") || formatCurrency(0)}
                              </div>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3">
                              <div
                                className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </section>
          )}

          {/* Modules Grid */}
          <section>
            <h2 className="text-xl font-semibold mb-4">Accounting Modules</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {modules.map((module, index) => (
                <Link key={index} href={module.href} className="block">
                  <div className="bg-card border rounded-xl p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-lg ${module.color}`}>
                        {module.icon}
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">
                          {module.title}
                        </h3>
                        <p className="text-muted-foreground text-sm">
                          {module.description}
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* Quick Actions */}
          <section>
            <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
            <div className="flex flex-wrap gap-3">
              <Link href="/dashboard/invoices/new">
                <Button variant="outline">
                  <FileText className="mr-2 h-4 w-4" /> Create Invoice
                </Button>
              </Link>
              <Link href="/dashboard/customers/new">
                <Button variant="outline">
                  <Users className="mr-2 h-4 w-4" /> Add Customer
                </Button>
              </Link>
              <Link href="/dashboard/products/new">
                <Button variant="outline">
                  <Package2 className="mr-2 h-4 w-4" /> Add Product
                </Button>
              </Link>
              <Link href="/dashboard/payments/new">
                <Button variant="outline">
                  <CreditCard className="mr-2 h-4 w-4" /> Record Payment
                </Button>
              </Link>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}