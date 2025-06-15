
"use client";

import DashboardNavbar from "@/components/dashboard-navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, Trash2, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../../../../../../supabase/client";
import { useEffect, useState, useRef } from "react";
import { Invoice, Product, Customer, InvoiceItems } from "@/app/types";

export default function EditInvoicePage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  
  // Change the type annotation here to explicitly allow null or empty array
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItems[]>([]);
  const [subtotal, setSubtotal] = useState(0);
  const [taxTotal, setTaxTotal] = useState(0);
  const [total, setTotal] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [activeItemIndex, setActiveItemIndex] = useState(0);

  const [defaultCurrency, setDefaultCurrency] = useState("HKD");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/sign-in";
        return;
      }

      // Fetch invoice with items
      const { data: invoiceData, error: invoiceError } = await supabase
        .from("invoices")
        .select(
          `
          *,
          invoice_items(*)
        `,
        )
        .eq("id", params.id)
        .single();

      if (invoiceError || !invoiceData) {
        console.error("Error fetching invoice:", invoiceError);
        router.push("/dashboard/invoices");
        return;
      }

      setInvoice(invoiceData);
      setDiscount(invoiceData.discount_amount || 0);
      setDefaultCurrency(invoiceData.currency_code || "HKD");

      // Format invoice items
      const items = invoiceData.invoice_items.map(
        (
          item: {
            product_id?: string;
            description?: string;
            quantity?: number;
            unit_price?: number;
          },
          index: number,
        ) => ({
          id: index,
          product_id: item.product_id || "",
          description: item.description || "",
          quantity: item.quantity || 0,
          unit_price: item.unit_price || 0,
        }),
      );

      setInvoiceItems(
        items.length > 0
          ? items
          : [
              {
                id: 0,
                product_id: "",
                description: "",
                quantity: 1,
                unit_price: 0,
                tax_rate: 0,
              },
            ],
      );

      // Fetch customers
      const { data: customersData, error } = await supabase
        .from("customers")
        .select("id, name")
        .order("name", { ascending: true });

      if (error) {
        console.error("Error fetching customers:", error.message);
        setCustomers([]); // Set to empty array if there's an error
      } else if (customersData) {
        // Use type assertion to handle the potential null case
        setCustomers(customersData as Customer[]);
      }

      // Rest of the fetch code remains the same...
      // (products, company profile, etc.)

      setLoading(false);
    };

    fetchData();
  }, [params.id, router]);

  // Calculate totals whenever invoice items change
  useEffect(() => {
    let newSubtotal = 0;
    let newTaxTotal = 0;

    invoiceItems.forEach((item) => {
      const lineTotal = item.quantity * item.unit_price;
      newSubtotal += lineTotal;

      if (item.tax_rate) {
        newTaxTotal += lineTotal * (item.tax_rate / 100);
      }
    });

    setSubtotal(newSubtotal);
    setTaxTotal(newTaxTotal);
    setTotal(newSubtotal + newTaxTotal - discount);
  }, [invoiceItems, discount]);

  // Filter products based on search term
  useEffect(() => {
    if (searchTerm.trim() === "") {
      setFilteredProducts(products);
    } else {
      const filtered = products.filter(
        (product) =>
          product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (product.sku &&
            product.sku.toLowerCase().includes(searchTerm.toLowerCase())),
      );
      setFilteredProducts(filtered);
    }
  }, [searchTerm, products]);

  const handleAddItem = () => {
    setInvoiceItems([
      ...invoiceItems,
      {
        id: invoiceItems.length,
        product_id: "",
        description: "",
        quantity: 1,
        unit_price: 0,
        tax_rate: 0,
        tax_amount: 0,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = [...invoiceItems];
    newItems.splice(index, 1);
    setInvoiceItems(newItems);
  };

  const handleItemChange = (
    index: number,
    field: keyof InvoiceItems,
    value: string | number | undefined
  ) => {
    const newItems = [...invoiceItems];
    (newItems[index] as any)[field] = value; // 用 any 暫時跳過型別檢查
    setInvoiceItems(newItems);
  };
  


// 選擇產品
const handleProductSelect = (product: Product, index: number) => {
  const newItems = [...invoiceItems];
  newItems[index].product_id = product.id;
  newItems[index].description = product.name;
  newItems[index].unit_price = product.price;
  newItems[index].tax_rate = product.tax_rate || 0;
  setInvoiceItems(newItems);
  setShowProductSearch(false);
};


// 打開產品搜尋視窗
const openProductSearch = (index: number) => {
  setActiveItemIndex(index);
  setShowProductSearch(true);
};

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: defaultCurrency,
    }).format(amount);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      // Make sure at least one item has a description
      const hasValidItems = invoiceItems.some(
        (item) => item.description.trim() !== "",
      );
      if (!hasValidItems) {
        setError("Please add at least one item with a description");
        setIsSubmitting(false);
        return;
      }

      const formData = new FormData(formRef.current!);
      if (!invoice) {
        setError("Invoice data not loaded.");
        setIsSubmitting(false);
        return;
      }
      formData.append("id", invoice.id);

       // Add calculated values
  formData.set("subtotal", subtotal.toString());
  formData.set("tax_amount", taxTotal.toString());
  formData.set("total_amount", total.toString());

      // Add invoice items with their original IDs if they exist
      invoiceItems.forEach((item, index) => {
        if (item.original_id) {
          formData.append(`items[${index}][id]`, item.original_id);
        }
      });

      // Make sure currency is one of the supported currencies
      const currency = formData.get("currency_code");
      const supportedCurrencies = [
        "HKD",
        "USD",
        "EUR",
        "GBP",
        "JPY",
        "CNY",
        "CAD",
        "AUD",
        "SGD",
      ];
      if (!supportedCurrencies.includes(String(currency))) {
        formData.set("currency_code", "HKD"); // Default to HKD if not supported
      }

      // Submit the form
      const supabase = createClient();

      // First, update the invoice
      const { error: invoiceError } = await supabase
        .from("invoices")
        .update({
          invoice_number: formData.get("invoice_number"),
          customer_id: formData.get("customer_id"),
          issue_date: formData.get("issue_date"),
          due_date: formData.get("due_date"),
          currency_code: formData.get("currency_code"),
          status: formData.get("status"),
          notes: formData.get("notes"),
          discount_amount: Number(formData.get("discount_amount") || 0),
          subtotal,
          tax_amount: taxTotal,
          total_amount: total,
          updated_at: new Date().toISOString(),
        })
        .eq("id", invoice.id);

      if (invoiceError) {
        throw new Error(`Failed to update invoice: ${invoiceError.message}`);
      }

      // Delete all existing invoice items
      const { error: deleteError } = await supabase
        .from("invoice_items")
        .delete()
        .eq("invoice_id", invoice.id);

      if (deleteError) {
        throw new Error(
          `Failed to update invoice items: ${deleteError.message}`,
        );
      }

      // Create new invoice items
      const items = [];
      for (let i = 0; formData.has(`items[${i}][description]`); i++) {
        const quantity = Number(formData.get(`items[${i}][quantity]`));
        const unitPrice = Number(formData.get(`items[${i}][unit_price]`));
        const taxRate = Number(formData.get(`items[${i}][tax_rate]`));
        const lineTotal = quantity * unitPrice;
        const taxAmount = lineTotal * (taxRate / 100);
        const productId = formData.get(`items[${i}][product_id]`) as string;

        items.push({
          invoice_id: invoice.id,
          product_id: productId && productId.trim() !== "" ? productId : null,
          description: formData.get(`items[${i}][description]`),
          quantity,
          unit_price: unitPrice,
          tax_rate: taxRate,
          tax_amount: taxAmount,
          line_total: lineTotal,
        });
      }

      if (items.length > 0) {
        const { error: itemsError } = await supabase
          .from("invoice_items")
          .insert(items);

        if (itemsError) {
          throw new Error(
            `Failed to create invoice items: ${itemsError.message}`,
          );
        }
      }

      router.push(`/dashboard/invoices/${invoice.id}`);
    } catch (error) {
      console.error("Error updating invoice:", error);
      if (error instanceof Error) {
        setError(
          error.message || "Failed to update invoice. Please check all fields and try again."
        );
      } else {
        setError("Failed to update invoice. Please check all fields and try again.");
      }
    
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <>
        <DashboardNavbar />
        <main className="w-full">
          <div className="container mx-auto px-4 py-8">
            <div className="flex items-center mb-6">
              <Link href="/dashboard/invoices" className="mr-4">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <h1 className="text-3xl font-bold">Loading invoice...</h1>
            </div>
          </div>
        </main>
      </>
    );
  }

  if (!invoice) {
    return (
      <>
        <DashboardNavbar />
        <main className="w-full">
          <div className="container mx-auto px-4 py-8">
            <div className="flex items-center mb-6">
              <Link href="/dashboard/invoices" className="mr-4">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <h1 className="text-3xl font-bold">Invoice not found</h1>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <DashboardNavbar />
      <main className="w-full">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center mb-6">
            <Link href="/dashboard/invoices" className="mr-4">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Edit Invoice</h1>
              <p className="text-muted-foreground">
                Update invoice {invoice.invoice_number}
              </p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
              {error}
            </div>
          )}

          <div className="bg-card rounded-xl p-6 border shadow-sm">
            <form ref={formRef} onSubmit={handleSubmit} className="space-y-8">
              {/* Invoice Header */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="invoice_number">Invoice Number *</Label>
                  <Input
                    id="invoice_number"
                    name="invoice_number"
                    placeholder="INV-0001"
                    defaultValue={invoice.invoice_number}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customer_id">Customer *</Label>
                  <select
                    id="customer_id"
                    name="customer_id"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    defaultValue={invoice.customer_id}
                    required
                  >
                    <option value="">Select a customer</option>
                    {customers?.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency_code">Currency</Label>
                  <select
                    id="currency_code"
                    name="currency_code"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    defaultValue={invoice.currency_code}
                  >
                    <option value="HKD">HKD - Hong Kong Dollar</option>
                    <option value="USD">USD - US Dollar</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="GBP">GBP - British Pound</option>
                    <option value="JPY">JPY - Japanese Yen</option>
                    <option value="CNY">CNY - Chinese Yuan</option>
                    <option value="CAD">CAD - Canadian Dollar</option>
                    <option value="AUD">AUD - Australian Dollar</option>
                    <option value="SGD">SGD - Singapore Dollar</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="issue_date">Issue Date *</Label>
                  <Input
                    id="issue_date"
                    name="issue_date"
                    type="date"
                    defaultValue={invoice.issue_date}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="due_date">Due Date *</Label>
                  <Input
                    id="due_date"
                    name="due_date"
                    type="date"
                    defaultValue={invoice.due_date}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <select
                    id="status"
                    name="status"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    defaultValue={invoice.status}
                  >
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="paid">Paid</option>
                    <option value="overdue">Overdue</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              {/* Invoice Items */}
              <div>
                <h3 className="text-lg font-medium mb-4">Invoice Items</h3>
                <div className="border rounded-md overflow-auto max-h-[500px]">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Item
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Quantity
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Unit Price
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Tax
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Total
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {invoiceItems.map((item, index) => (
                        <tr key={item.id}>
                          <td className="px-6 py-4 whitespace-nowrap relative">
                            <div className="flex items-center">
                              <Input
                                name={`items[${index}][description]`}
                                placeholder="Description"
                                value={item.description}
                                onChange={(e) =>
                                  handleItemChange(
                                    index,
                                    "description",
                                    e.target.value,
                                  )
                                }
                                className="w-full"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => openProductSearch(index)}
                                className="ml-2"
                              >
                                <Search className="h-4 w-4" />
                              </Button>
                              <input
                                type="hidden"
                                name={`items[${index}][product_id]`}
                                value={item.product_id || ""}
                              />
                            </div>

                            {showProductSearch && activeItemIndex === index && (
                              <div className="absolute z-10 mt-1 w-full bg-white border rounded-md shadow-lg max-h-96 overflow-auto">
                                <div className="p-2 sticky top-0 bg-white border-b">
                                  <Input
                                    placeholder="Search products..."
                                    value={searchTerm}
                                    onChange={(e) =>
                                      setSearchTerm(e.target.value)
                                    }
                                    className="w-full"
                                    autoFocus
                                  />
                                </div>
                                <ul className="max-h-80 overflow-y-auto">
                                  {filteredProducts.map((product) => (
                                    <li
                                      key={product.id}
                                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                                      onClick={() =>
                                        handleProductSelect(product, index)
                                      }
                                    >
                                      <div className="font-medium">
                                        {product.name}
                                      </div>
                                      <div className="text-sm text-gray-500 flex justify-between">
                                        <span>{product.sku}</span>
                                        <span>
                                          {formatCurrency(product.price)}
                                        </span>
                                      </div>
                                    </li>
                                  ))}
                                  {filteredProducts.length === 0 && (
                                    <li className="px-4 py-2 text-gray-500">
                                      No products found
                                    </li>
                                  )}
                                </ul>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Input
                              name={`items[${index}][quantity]`}
                              type="number"
                              min="1"
                              step="1"
                              value={item.quantity}
                              onChange={(e) =>
                                handleItemChange(
                                  index,
                                  "quantity",
                                  parseInt(e.target.value) || 1,
                                )
                              }
                              className="w-20"
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Input
                              name={`items[${index}][unit_price]`}
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unit_price}
                              onChange={(e) =>
                                handleItemChange(
                                  index,
                                  "unit_price",
                                  parseFloat(e.target.value) || 0,
                                )
                              }
                              className="w-28"
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Input
                              name={`items[${index}][tax_rate]`}
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.tax_rate}
                              onChange={(e) =>
                                handleItemChange(
                                  index,
                                  "tax_rate",
                                  parseFloat(e.target.value) || 0,
                                )
                              }
                              className="w-20"
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium">
                              {formatCurrency(item.quantity * item.unit_price)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Button
                              variant="ghost"
                              size="icon"
                              type="button"
                              onClick={() => handleRemoveItem(index)}
                              disabled={invoiceItems.length === 1}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 sticky bottom-0 bg-white p-2 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddItem}
                  >
                    <Plus className="h-4 w-4 mr-2" /> Add Item
                  </Button>
                </div>
              </div>

              {/* Invoice Totals */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    name="notes"
                    placeholder="Additional notes for the customer"
                    defaultValue={invoice.notes || ""}
                    rows={4}
                  />
                </div>

                <div className="space-y-4 bg-gray-50 p-4 rounded-md">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Subtotal:</span>
                    <span className="text-sm font-medium">
                      {formatCurrency(subtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Tax:</span>
                    <span className="text-sm font-medium">
                      {formatCurrency(taxTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <Label htmlFor="discount_amount">Discount:</Label>
                    <div className="flex items-center">
                      <Input
                        id="discount_amount"
                        name="discount_amount"
                        type="number"
                        min="0"
                        step="0.01"
                        value={discount}
                        onChange={(e) =>
                          setDiscount(parseFloat(e.target.value) || 0)
                        }
                        className="w-24 h-8"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-base font-medium">Total:</span>
                    <span className="text-base font-bold">
                      {formatCurrency(total)}
                    </span>
                  </div>

                  {/* Hidden fields to submit calculated values */}
                  <input type="hidden" name="subtotal" value={subtotal} />
                  <input type="hidden" name="tax_amount" value={taxTotal} />
                  <input type="hidden" name="total_amount" value={total} />
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Link href="/dashboard/invoices">
                  <Button variant="outline" type="button">
                    Cancel
                  </Button>
                </Link>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Update Invoice"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </>
  );
}
