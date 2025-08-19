import DashboardNavbar from "@/components/dashboard-navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart3,
  LineChart,
  PieChart,
  Download,
  TrendingUp,
  TrendingDown,
  DollarSign,
} from "lucide-react";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "../../../../supabase/server";
import {
  getFinancialReports,
  downloadRevenueReport,
  downloadExpenseReport,
  downloadCashFlowReport,
} from "./actions";
import { DownloadButton } from "./download-button";

export default async function ReportsPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  const reportData = await getFinancialReports();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const hasData = reportData.totalRevenue > 0 || reportData.totalExpenses > 0;

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
            {hasData && (
              <div className="flex gap-2">
                <DownloadButton
                  action={downloadRevenueReport}
                  variant="outline"
                >
                  <Download className="mr-2 h-4 w-4" /> Export Revenue Report
                </DownloadButton>
                <DownloadButton
                  action={downloadExpenseReport}
                  variant="outline"
                >
                  <Download className="mr-2 h-4 w-4" /> Export Expense Report
                </DownloadButton>
                <DownloadButton
                  action={downloadCashFlowReport}
                  variant="outline"
                >
                  <Download className="mr-2 h-4 w-4" /> Export Cash Flow Report
                </DownloadButton>
              </div>
            )}
          </div>

          {/* Financial Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Revenue
                </CardTitle>
                <DollarSign className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(reportData.totalRevenue)}
                </div>
                <p className="text-xs text-muted-foreground">
                  From {reportData.payments.length} payments
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Expenses
                </CardTitle>
                <TrendingDown className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(reportData.totalExpenses)}
                </div>
                <p className="text-xs text-muted-foreground">
                  From {reportData.expenses.length} expenses
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Net Cash Flow
                </CardTitle>
                <TrendingUp
                  className={`h-4 w-4 ${reportData.netCashFlow >= 0 ? "text-green-600" : "text-red-600"}`}
                />
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${reportData.netCashFlow >= 0 ? "text-green-600" : "text-red-600"}`}
                >
                  {formatCurrency(reportData.netCashFlow)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Revenue - Expenses
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Outstanding
                </CardTitle>
                <DollarSign className="h-4 w-4 text-amber-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">
                  {formatCurrency(reportData.totalOutstanding)}
                </div>
                <p className="text-xs text-muted-foreground">
                  From {reportData.outstandingInvoices.length} unpaid invoices
                </p>
              </CardContent>
            </Card>
          </div>

          {hasData ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {/* Revenue Analysis */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Revenue Analysis</CardTitle>
                  <LineChart className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">
                        Monthly Revenue
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {Object.keys(reportData.revenueByMonth).length} months
                      </span>
                    </div>
                    <div className="space-y-2">
                      {Object.entries(reportData.revenueByMonth)
                        .slice(0, 5)
                        .map(([month, amount]) => (
                          <div
                            key={month}
                            className="flex justify-between items-center"
                          >
                            <span className="text-sm">{month}</span>
                            <span className="text-sm font-medium">
                              {formatCurrency(amount)}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Expense Breakdown */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Expense Breakdown</CardTitle>
                  <PieChart className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">By Category</span>
                      <span className="text-sm text-muted-foreground">
                        {Object.keys(reportData.expensesByCategory).length}{" "}
                        categories
                      </span>
                    </div>
                    <div className="space-y-2">
                      {Object.entries(reportData.expensesByCategory)
                        .slice(0, 5)
                        .map(([category, amount]) => (
                          <div
                            key={category}
                            className="flex justify-between items-center"
                          >
                            <span className="text-sm capitalize">
                              {category}
                            </span>
                            <span className="text-sm font-medium">
                              {formatCurrency(Number(amount) || 0)}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Cash Flow */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Cash Flow</CardTitle>
                  <BarChart3 className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">
                        Monthly Comparison
                      </span>
                    </div>
                    <div className="space-y-2">
                      {Object.keys(reportData.revenueByMonth)
                        .slice(0, 3)
                        .map((month) => {
                          const revenue = reportData.revenueByMonth[month] || 0;
                          const expenses =
                            reportData.expensesByMonth[month] || 0;
                          const netFlow = revenue - expenses;
                          return (
                            <div key={month} className="space-y-1">
                              <div className="flex justify-between items-center">
                                <span className="text-sm">{month}</span>
                                <span
                                  className={`text-sm font-medium ${
                                    netFlow >= 0
                                      ? "text-green-600"
                                      : "text-red-600"
                                  }`}
                                >
                                  {formatCurrency(netFlow)}
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Revenue: {formatCurrency(revenue)} | Expenses:{" "}
                                {formatCurrency(expenses)}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
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
                    <h3 className="text-lg font-medium mb-2">
                      No revenue data
                    </h3>
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
                    <h3 className="text-lg font-medium mb-2">
                      No expense data
                    </h3>
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
          )}

          {/* Recent Transactions */}
          {hasData && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Payments */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Payments</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {reportData.payments.slice(0, 5).map((payment, index) => (
                      <div
                        key={payment.id || index}
                        className="flex justify-between items-center"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {payment.invoices?.customers?.name ||
                              "Unknown Customer"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {payment.invoices?.invoice_number || "N/A"} •{" "}
                            {new Date(
                              payment.payment_date,
                            ).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-green-600">
                            {formatCurrency(payment.amount)}
                          </p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {payment.payment_method}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Expenses */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Expenses</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {reportData.expenses.slice(0, 5).map((expense) => (
                      <div
                        key={expense.id}
                        className="flex justify-between items-center"
                      >
                        <div>
                          <p className="text-sm font-medium">{expense.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {expense.category} •{" "}
                            {new Date(
                              expense.expense_date,
                            ).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-red-600">
                            {formatCurrency(expense.amount)}
                          </p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {expense.payment_method}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {!hasData && (
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
                  <Button variant="outline" disabled>
                    Generate Revenue Report
                  </Button>
                  <Button variant="outline" disabled>
                    Generate Expense Report
                  </Button>
                  <Button variant="outline" disabled>
                    Generate Cash Flow Report
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
