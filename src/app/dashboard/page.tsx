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
import { createClient } from "../../supabase/server";

export default async function Dashboard() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

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
                  <div className="text-2xl font-bold">$0.00</div>
                  <p className="text-xs text-muted-foreground">
                    No revenue recorded yet
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
                  <div className="text-2xl font-bold">$0.00</div>
                  <p className="text-xs text-muted-foreground">
                    No outstanding invoices
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
                  <div className="text-2xl font-bold">0</div>
                  <p className="text-xs text-muted-foreground">
                    No customers added yet
                  </p>
                </CardContent>
              </Card>
            </div>
          </section>

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
