"use client";

import DashboardNavbar from "@/components/dashboard-navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, Trash2, Search } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../../../../supabase/client";
import { createInvoiceAction } from "../actions";
import { useEffect, useState, useRef, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Customer } from "@/app/types";

type InvoiceItem = {
  id: number;
  product_id: string;
  product_name: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
};

type Product = {
  id: string;
  name: string;
  sku: string;
  price: number;
  tax_rate: number;
  description: string;
  // other product fields if any
};

export default function NewInvoicePage() {
  const router = useRouter();
  const formRef = useRef(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [invoiceItems, setInvoiceItems] = useState([
    {
      id: 0,
      product_id: "",
      product_name: "",
      description: "",
      quantity: 1,
      unit_price: 0,
      tax_rate: 0,
    },
  ]);
  const [subtotal, setSubtotal] = useState(0);
  const [taxTotal, setTaxTotal] = useState(0);
  const [total, setTotal] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [defaultCurrency, setDefaultCurrency] = useState("HKD");
  const [currencies, setCurrencies] = useState<
    Array<{
      id: string;
      code: string;
      name: string;
      symbol: string;
      is_default: boolean;
    }>
  >([]);
  const [nextInvoiceNumber, setNextInvoiceNumber] = useState("");
  const [companyProfile, setCompanyProfile] = useState(null);
  const [invoicePrefix, setInvoicePrefix] = useState("INV-");

  useEffect(() => {
    // Check for duplicate data in sessionStorage
    const duplicateData = sessionStorage.getItem("duplicateInvoiceData");

    if (duplicateData) {
      try {
        const parsedData = JSON.parse(duplicateData);

        // Set discount
        if (parsedData.discount_amount) {
          setDiscount(parsedData.discount_amount);
        }

        // Set invoice items
        if (parsedData.items && parsedData.items.length > 0) {
          const duplicatedItems = parsedData.items.map(
            (item: any, index: number) => ({
              id: index,
              product_id: item.product_id || "",
              product_name: item.product_name || "",
              description: item.description || "",
              quantity: item.quantity || 1,
              unit_price: item.unit_price || 0,
              tax_rate: item.tax_rate || 0,
            }),
          );
          setInvoiceItems(duplicatedItems);
        }

        // Store the parsed data to use after components are loaded
        window.duplicateInvoiceData = parsedData;

        // Clear the sessionStorage
        sessionStorage.removeItem("duplicateInvoiceData");
      } catch (error) {
        console.error("Error parsing duplicate data:", error);
      }
    }

    // Check authentication
    const checkAuth = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/sign-in";
        return;
      }

      // Fetch customers
      const { data: customersData } = await supabase
        .from("customers")
        .select("id, name")
        .order("name", { ascending: true });

      if (customersData) {
        setCustomers(customersData);
      }

      // Fetch products
      const { data: productsData } = await supabase
        .from("products")
        .select("*")
        .eq("user_id", user.id)
        .order("name", { ascending: true });

      if (productsData) {
        setProducts(productsData);
        setFilteredProducts(productsData);
      }

      // Fetch company profile
      const { data: profileData } = await supabase
        .from("company_profile")
        .select("*")
        .limit(1)
        .single();

      if (profileData) {
        setCompanyProfile(profileData);
        if (profileData.prefix) {
          setInvoicePrefix(profileData.prefix);
        }
      }

      // Fetch currencies for the current user
      const { data: currenciesData } = await supabase
        .from("currencies")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("is_default", { ascending: false })
        .order("code", { ascending: true });

      setCurrencies(currenciesData || []);

      // Set default currency
      const defaultCurr =
        currenciesData?.find((c) => c.is_default)?.code || "HKD";
      setDefaultCurrency(defaultCurr);

      // Apply duplicate data after all data is loaded
      if ((window as any).duplicateInvoiceData) {
        const duplicateData = (window as any).duplicateInvoiceData;

        // Set customer
        if (duplicateData.customer_id) {
          setTimeout(() => {
            const customerSelect = document.getElementById(
              "customer_id",
            ) as HTMLSelectElement;
            if (customerSelect) {
              customerSelect.value = duplicateData.customer_id;
            }
          }, 1000);
        }

        // Set currency
        if (duplicateData.currency_code) {
          setTimeout(() => {
            const currencySelect = document.getElementById(
              "currency_code",
            ) as HTMLSelectElement;
            if (currencySelect) {
              currencySelect.value = duplicateData.currency_code;
            }
          }, 1000);
        }

        // Set notes
        if (duplicateData.notes) {
          setTimeout(() => {
            const notesTextarea = document.getElementById(
              "notes",
            ) as HTMLTextAreaElement;
            if (notesTextarea) {
              notesTextarea.value = duplicateData.notes;
            }
          }, 1000);
        }

        // Clear the stored data
        delete (window as any).duplicateInvoiceData;
      }

      // Get latest invoice number for the current user
      const { data: latestInvoice } = await supabase
        .from("invoices")
        .select("invoice_number")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      let nextNumber = 1;
      const currentPrefix = profileData?.prefix || "INV-";

      if (latestInvoice?.invoice_number) {
        // Extract number from the latest invoice with the current prefix
        const escapedPrefix = currentPrefix.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&",
        );
        const regex = new RegExp(`^${escapedPrefix}(\\d+)`);
        const match = latestInvoice.invoice_number.match(regex);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        } else {
          // If the latest invoice doesn't match current prefix format,
          // find the highest number with current prefix
          const { data: allInvoices } = await supabase
            .from("invoices")
            .select("invoice_number")
            .eq("user_id", user.id)
            .like("invoice_number", `${currentPrefix}%`);

          if (allInvoices && allInvoices.length > 0) {
            const numbers = allInvoices
              .map((inv) => {
                const match = inv.invoice_number.match(regex);
                return match ? parseInt(match[1]) : 0;
              })
              .filter((num) => num > 0);

            if (numbers.length > 0) {
              nextNumber = Math.max(...numbers) + 1;
            }
          }
        }
      }

      const generatedInvoiceNumber = `${currentPrefix}${String(nextNumber).padStart(4, "0")}`;
      setNextInvoiceNumber(generatedInvoiceNumber);
    };

    checkAuth();
  }, []);

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
        product_name: "",
        description: "",
        quantity: 1,
        unit_price: 0,
        tax_rate: 0,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = [...invoiceItems];
    newItems.splice(index, 1);
    setInvoiceItems(newItems);
  };

  const handleItemChange = <K extends keyof InvoiceItem>(
    index: number,
    field: K,
    value: InvoiceItem[K],
  ) => {
    const newItems = [...invoiceItems];
    newItems[index][field] = value;
    setInvoiceItems(newItems);
  };

  const handleProductSelect = (product: Product, index: number) => {
    const newItems = [...invoiceItems];
    newItems[index].product_id = product.id;
    newItems[index].product_name = product.name;
    newItems[index].description = product.description;
    newItems[index].unit_price = product.price;
    newItems[index].tax_rate = product.tax_rate || 0;
    setInvoiceItems(newItems);
    setShowProductSearch(false);
  };

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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
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

      // Add calculated values
      formData.set("subtotal", subtotal.toString());
      formData.set("tax_amount", taxTotal.toString());
      formData.set("total_amount", total.toString());

      // Make sure currency is one of the supported currencies
      const currency = formData.get("currency_code");
      const currencyStr = typeof currency === "string" ? currency : "";
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
      if (!supportedCurrencies.includes(currencyStr)) {
        formData.set("currency_code", "HKD"); // Default to HKD if not supported
      }

      // Submit the form
      const result = await createInvoiceAction(formData);
      router.push("/dashboard/invoices");
    } catch (error) {
      console.error("Error submitting invoice:", error);
      setError(
        "Failed to create invoice. Please check all fields and try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

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
              <h1 className="text-3xl font-bold">Create New Invoice</h1>
              <p className="text-muted-foreground">
                Generate a new invoice for a customer
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
                    value={nextInvoiceNumber}
                    readOnly
                    className="bg-gray-50"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Auto-generated from company prefix
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customer_id">Customer *</Label>
                  <select
                    id="customer_id"
                    name="customer_id"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
                    defaultValue={defaultCurrency}
                  >
                    {currencies?.map((currency) => (
                      <option key={currency.id} value={currency.code}>
                        {currency.code} - {currency.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="issue_date">Issue Date *</Label>
                  <Input
                    id="issue_date"
                    name="issue_date"
                    type="date"
                    defaultValue={new Date().toISOString().split("T")[0]}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="due_date">Due Date *</Label>
                  <Input
                    id="due_date"
                    name="due_date"
                    type="date"
                    defaultValue={
                      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                        .toISOString()
                        .split("T")[0]
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <select
                    id="status"
                    name="status"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    defaultValue="draft"
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
                          <td className="px-6 py-4 relative">
                            <div className="space-y-2">
                              <Input
                                name={`items[${index}][product_name]`}
                                placeholder="Product name"
                                value={item.product_name || ""}
                                onChange={(e) =>
                                  handleItemChange(
                                    index,
                                    "product_name",
                                    e.target.value,
                                  )
                                }
                                className="w-full text-sm font-medium"
                              />
                              <div className="flex items-center">
                                <Input
                                  name={`items[${index}][description]`}
                                  placeholder="Item description"
                                  value={item.description || ""}
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
                  {isSubmitting ? "Saving..." : "Save Invoice"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </>
  );
}