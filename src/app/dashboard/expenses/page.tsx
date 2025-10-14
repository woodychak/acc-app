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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import * as XLSX from "xlsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Expense {
  id: string;
  title: string;
  amount: number;
  date: string;
  expense_date: string;
  // add other properties as needed
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [filteredExpenses, setFilteredExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [defaultCurrency, setDefaultCurrency] = useState("USD");
  const [dateFilter, setDateFilter] = useState({ from: "", to: "" });
  const [filterOpen, setFilterOpen] = useState(false);
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewReceiptDialogOpen, setViewReceiptDialogOpen] = useState(false);
  const [currentReceiptUrls, setCurrentReceiptUrls] = useState<string[]>([]);
  const [currentReceiptIndex, setCurrentReceiptIndex] = useState(0);

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

  const handleDeleteClick = (expense: Expense) => {
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

  const formatCurrency = (amount: number, currencyCode: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode || defaultCurrency,
    }).format(amount);
  };

  type DateFilter = {
    from: string | null;
    to: string | null;
  };

  const handleDateFilterChange = (
    field: keyof DateFilter,
    value: string | null,
  ) => {
    setDateFilter((prev) => ({ ...prev, [field]: value }));
  };

  const clearDateFilter = () => {
    setDateFilter({ from: "", to: "" });
  };

  type Expense = {
    id: string;
    title: string;
    amount: number;
    currency_code: string;
    category?: string;
    expense_date: string;
    vendor?: string;
    payment_method?: string;
    description?: string;
    notes?: string;
    receipt_url?: string;
    receipt_urls?: string[];
    // ...other fields
  };

  const handleViewReceipts = (expense: Expense) => {
    const urls: string[] = [];
    
    if (expense.receipt_urls && Array.isArray(expense.receipt_urls)) {
      urls.push(...expense.receipt_urls);
    } else if (expense.receipt_url) {
      urls.push(expense.receipt_url);
    }
    
    if (urls.length > 0) {
      setCurrentReceiptUrls(urls);
      setCurrentReceiptIndex(0);
      setViewReceiptDialogOpen(true);
    }
  };

  const nextReceipt = () => {
    if (currentReceiptIndex < currentReceiptUrls.length - 1) {
      setCurrentReceiptIndex(currentReceiptIndex + 1);
    }
  };

  const prevReceipt = () => {
    if (currentReceiptIndex > 0) {
      setCurrentReceiptIndex(currentReceiptIndex - 1);
    }
  };

  const getReceiptCount = (expense: Expense) => {
    if (expense.receipt_urls && Array.isArray(expense.receipt_urls)) {
      return expense.receipt_urls.length;
    } else if (expense.receipt_url) {
      return 1;
    }
    return 0;
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  // Pagination logic
  const totalPages = Math.ceil(filteredExpenses.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedExpenses = filteredExpenses.slice(startIndex, endIndex);

  const handlePageSizeChange = (value: string) => {
    setPageSize(Number(value));
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
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
            <div className="flex gap-2 items-center">
              <Select
                value={pageSize.toString()}
                onValueChange={handlePageSizeChange}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">Show 25</SelectItem>
                  <SelectItem value="50">Show 50</SelectItem>
                </SelectContent>
              </Select>
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
              <div className="mb-4 flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  Showing {startIndex + 1} to{" "}
                  {Math.min(endIndex, filteredExpenses.length)} of{" "}
                  {filteredExpenses.length} expenses
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="flex items-center px-3 text-sm">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
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
                  {paginatedExpenses.map((expense) => {
                    const receiptCount = getReceiptCount(expense);
                    return (
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
                          {receiptCount > 0 ? (
                            <button
                              onClick={() => handleViewReceipts(expense)}
                              className="text-blue-600 hover:underline flex items-center cursor-pointer bg-transparent border-none p-0"
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View {receiptCount > 1 ? `(${receiptCount})` : ''}
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
                    );
                  })}
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

      {/* Receipt Viewer Dialog */}
      <Dialog open={viewReceiptDialogOpen} onOpenChange={setViewReceiptDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              Receipt {currentReceiptIndex + 1} of {currentReceiptUrls.length}
            </DialogTitle>
          </DialogHeader>
          <div className="relative">
            <img
              src={currentReceiptUrls[currentReceiptIndex]}
              alt={`Receipt ${currentReceiptIndex + 1}`}
              className="w-full h-auto max-h-[70vh] object-contain"
            />
            
            {currentReceiptUrls.length > 1 && (
              <div className="flex justify-between items-center mt-4">
                <Button
                  variant="outline"
                  onClick={prevReceipt}
                  disabled={currentReceiptIndex === 0}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                
                <div className="flex gap-2">
                  {currentReceiptUrls.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentReceiptIndex(index)}
                      className={`w-2 h-2 rounded-full ${
                        index === currentReceiptIndex
                          ? "bg-blue-600"
                          : "bg-gray-300"
                      }`}
                    />
                  ))}
                </div>
                
                <Button
                  variant="outline"
                  onClick={nextReceipt}
                  disabled={currentReceiptIndex === currentReceiptUrls.length - 1}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

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