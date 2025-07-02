"use client";

import DashboardNavbar from "@/components/dashboard-navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Receipt,
  Plus,
  Pencil,
  Trash2,
  Eye,
  Download,
  Filter,
  Calendar,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "../../../../supabase/client";
import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import * as XLSX from "xlsx";

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState([]);
  const [filteredExpenses, setFilteredExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [defaultCurrency, setDefaultCurrency] = useState("USD");
  const [dateFilter, setDateFilter] = useState({ from: "", to: "" });
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/sign-in";
        return;
      }

      // Fetch company profile for default currency
      const { data: companyData } = await supabase
        .from("company_profile")
        .select("default_currency")
        .eq("user_id", user.id)
        .single();

      if (companyData?.default_currency) {
        setDefaultCurrency(companyData.default_currency);
      }

      // Fetch expenses
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("user_id", user.id)
        .order("expense_date", { ascending: false });

      if (data) {
        setExpenses(data);
        setFilteredExpenses(data);
      }
      setLoading(false);
    };

    fetchData();
  }, []);

  useEffect(() => {
    let filtered = [...expenses];

    if (dateFilter.from) {
      filtered = filtered.filter(
        (expense) => expense.expense_date >= dateFilter.from,
      );
    }
    if (dateFilter.to) {
      filtered = filtered.filter(
        (expense) => expense.expense_date <= dateFilter.to,
      );
    }

    setFilteredExpenses(filtered);
  }, [expenses, dateFilter]);

  const handleDeleteClick = (expense) => {
    setExpenseToDelete(expense);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!expenseToDelete) return;

    const supabase = createClient();
    const { error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", expenseToDelete.id);

    if (error) {
      setDeleteError("Failed to delete expense");
      return;
    }

    const updatedExpenses = expenses.filter((e) => e.id !== expenseToDelete.id);
    setExpenses(updatedExpenses);
    setFilteredExpenses(
      updatedExpenses.filter((expense) => {
        let include = true;
        if (dateFilter.from)
          include = include && expense.expense_date >= dateFilter.from;
        if (dateFilter.to)
          include = include && expense.expense_date <= dateFilter.to;
        return include;
      }),
    );
    setDeleteDialogOpen(false);
    setExpenseToDelete(null);
  };

  const formatCurrency = (amount, currencyCode) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode || defaultCurrency,
    }).format(amount);
  };

  const handleDateFilterChange = (field, value) => {
    setDateFilter((prev) => ({ ...prev, [field]: value }));
  };

  const clearDateFilter = () => {
    setDateFilter({ from: "", to: "" });
  };

  const exportToExcel = () => {
    const exportData = filteredExpenses.map((expense) => ({
      Title: expense.title,
      Amount: expense.amount,
      Currency: expense.currency_code,
      Category: expense.category || "Uncategorized",
      Date: formatDate(expense.expense_date),
      Vendor: expense.vendor || "-",
      "Payment Method": expense.payment_method || "-",
      Description: expense.description || "-",
      Notes: expense.notes || "-",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Expenses");

    const fileName = `expenses_${new Date().toISOString().split("T")[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <>
      <DashboardNavbar />
      <main className="w-full bg-white">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold">Expenses</h1>
              <p className="text-muted-foreground">
                Track and manage your business expenses
              </p>
            </div>
            <div className="flex gap-2">
              <Popover open={filterOpen} onOpenChange={setFilterOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline">
                    <Filter className="mr-2 h-4 w-4" /> Filter
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="space-y-4">
                    <h4 className="font-medium">Date Range Filter</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="from-date">From</Label>
                        <Input
                          id="from-date"
                          type="date"
                          value={dateFilter.from}
                          onChange={(e) =>
                            handleDateFilterChange("from", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="to-date">To</Label>
                        <Input
                          id="to-date"
                          type="date"
                          value={dateFilter.to}
                          onChange={(e) =>
                            handleDateFilterChange("to", e.target.value)
                          }
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={clearDateFilter}
                        variant="outline"
                      >
                        Clear
                      </Button>
                      <Button size="sm" onClick={() => setFilterOpen(false)}>
                        Apply
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              <Button variant="outline" onClick={exportToExcel}>
                <Download className="mr-2 h-4 w-4" /> Export XLS
              </Button>
              <Link href="/dashboard/expenses/new">
                <Button>
                  <Plus className="mr-2 h-4 w-4" /> Add Expense
                </Button>
              </Link>
            </div>
          </div>

          {loading ? (
            <div className="bg-card rounded-xl p-8 border shadow-sm flex justify-center">
              <p>Loading expenses...</p>
            </div>
          ) : filteredExpenses && filteredExpenses.length > 0 ? (
            <div className="bg-card rounded-xl p-4 border shadow-sm">
              <table className="w-full table-auto text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="p-2">Title</th>
                    <th className="p-2">Amount</th>
                    <th className="p-2">Category</th>
                    <th className="p-2">Date</th>
                    <th className="p-2">Vendor</th>
                    <th className="p-2">Receipt</th>
                    <th className="p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.map((expense) => (
                    <tr key={expense.id} className="border-b">
                      <td className="p-2 font-medium">{expense.title}</td>
                      <td className="p-2">
                        {formatCurrency(expense.amount, expense.currency_code)}
                      </td>
                      <td className="p-2">
                        <span className="px-2 py-1 bg-gray-100 rounded-full text-xs">
                          {expense.category || "Uncategorized"}
                        </span>
                      </td>
                      <td className="p-2">
                        {formatDate(expense.expense_date)}
                      </td>
                      <td className="p-2">{expense.vendor || "-"}</td>
                      <td className="p-2">
                        {expense.receipt_url ? (
                          <button
                            onClick={() =>
                              window.open(expense.receipt_url, "_blank")
                            }
                            className="text-blue-600 hover:underline flex items-center cursor-pointer bg-transparent border-none p-0"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </button>
                        ) : (
                          <span className="text-gray-400">No receipt</span>
                        )}
                      </td>
                      <td className="p-2 flex gap-2">
                        <Link href={`/dashboard/expenses/edit/${expense.id}`}>
                          <Button size="sm" variant="outline">
                            <Pencil className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDeleteClick(expense)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
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
                  <Receipt className="h-12 w-12 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold mb-2">No expenses yet</h2>
                <p className="text-muted-foreground max-w-md mb-6">
                  Start tracking your business expenses by adding your first
                  expense.
                </p>
                <Link href="/dashboard/expenses/new">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" /> Add Your First Expense
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteError ? (
                <p className="text-red-500">{deleteError}</p>
              ) : (
                <>
                  This action cannot be undone. This will permanently delete the
                  expense <strong>{expenseToDelete?.title}</strong>.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteError("")}>
              Cancel
            </AlertDialogCancel>
            {!deleteError && (
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
