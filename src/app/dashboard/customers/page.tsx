import DashboardNavbar from "@/components/dashboard-navbar";
import { Button } from "@/components/ui/button";
import { Users, Plus, Pencil } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../../supabase/server";
import { DeleteCustomerButton } from "@/components/DeleteCustomerButton";

export default async function CustomersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return redirect("/sign-in");

  const { data: customers, error } = await supabase
    .from("customers")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <>
      <DashboardNavbar />
      <main className="w-full">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold">Customers</h1>
              <p className="text-muted-foreground">
                Manage your customer database
              </p>
            </div>
            <Link href="/dashboard/customers/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Add Customer
              </Button>
            </Link>
          </div>

          {customers && customers.length > 0 ? (
            <div className="bg-card rounded-xl p-4 border shadow-sm">
              <table className="w-full table-auto text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="p-2">Name</th>
                    <th className="p-2">Email</th>
                    <th className="p-2">Phone</th>
                    <th className="p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => (
                    <tr key={customer.id} className="border-b">
                      <td className="p-2">{customer.name}</td>
                      <td className="p-2">{customer.email}</td>
                      <td className="p-2">{customer.phone}</td>
                      <td className="p-2 flex gap-2">
                        <Link href={`/dashboard/customers/edit/${customer.id}`}>
                          <Button size="sm" variant="outline">
                            <Pencil className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                        </Link>
                        <DeleteCustomerButton customerId={customer.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-card rounded-xl p-8 border shadow-sm">
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="bg-primary/10 p-4 rounded-full mb-4">
                  <Users className="h-12 w-12 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold mb-2">
                  No customers yet
                </h2>
                <p className="text-muted-foreground max-w-md mb-6">
                  Get started by adding your first customer to your database.
                </p>
                <Link href="/dashboard/customers/new">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" /> Add Your First Customer
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
