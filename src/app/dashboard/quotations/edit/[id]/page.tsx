"use client";

import DashboardNavbar from "@/components/dashboard-navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, Trash2, Search } from "lucide-react";
import Link from "next/link";
import { createClient } from "../../../../../../supabase/client";
import { useEffect, useState, useRef, FormEvent } from "react";
import { useRouter, useParams } from "next/navigation";
import { Customer, Quotation } from "@/app/types";

type QuotationItem = {
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
};

export default function EditQuotationPage() {
  const router = useRouter();
  const params = useParams();
  const quotationId = params.id as string;
  const formRef = useRef(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [quotationItems, setQuotationItems] = useState<QuotationItem[]>([]);
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

  useEffect(() => {
    const fetchQuotationData = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/sign-in";
        return;
      }

      // Fetch quotation with items
      const { data: quotationData, error: quotationError } = await supabase
        .from("quotations")
        .select(`
          *,
          quotation_items(*)
        `)
        .eq("id", quotationId)
        .eq("user_id", user.id)
        .single();

      if (quotationError || !quotationData) {
        setError("Quotation not found");
        setLoading(false);
        return;
      }

      setQuotation(quotationData);
      setDiscount(quotationData.discount_amount || 0);

      // Convert quotation items to the format expected by the form
      if (quotationData.quotation_items && quotationData.quotation_items.length > 0) {
        const items = quotationData.quotation_items.map((item: any, index: number) => ({
          id: index,
          product_id: item.product_id || "",
          product_name: "", // Will be populated from products if needed
          description: item.description || "",
          quantity: item.quantity || 1,
          unit_price: item.unit_price || 0,
          tax_rate: item.tax_rate || 0,
        }));
        setQuotationItems(items);
      } else {
        setQuotationItems([{
          id: 0,
          product_id: "",
          product_name: "",
          description: "",
          quantity: 1,
          unit_price: 0,
          tax_rate: 0,
        }]);
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
        
        // Populate product names for existing items
        if (quotationData.quotation_items && quotationData.quotation_items.length > 0) {
          const updatedItems = quotationData.quotation_items.map((item: any, index: number) => {
            const product = productsData.find(p => p.id === item.product_id);
            return {
              id: index,
              product_id: item.product_id || "",
              product_name: product ? product.name : "",
              description: item.description || "",
              quantity: item.quantity || 1,
              unit_price: item.unit_price || 0,
              tax_rate: item.tax_rate || 0,
            };
          });
          setQuotationItems(updatedItems);
        }
      }

      // Fetch currencies
      const { data: currenciesData } = await supabase
        .from("currencies")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("is_default", { ascending: false })
        .order("code", { ascending: true });

      setCurrencies(currenciesData || []);

      const defaultCurr = currenciesData?.find((c) => c.is_default)?.code || "HKD";
      setDefaultCurrency(defaultCurr);

      setLoading(false);
    };

    if (quotationId) {
      fetchQuotationData();
    }
  }, [quotationId]);

  // Calculate totals whenever quotation items change
  useEffect(() => {
    let newSubtotal = 0;
    let newTaxTotal = 0;

    quotationItems.forEach((item) => {
      const lineTotal = item.quantity * item.unit_price;
      newSubtotal += lineTotal;

      if (item.tax_rate) {
        newTaxTotal += lineTotal * (item.tax_rate / 100);
      }
    });

    setSubtotal(newSubtotal);
    setTaxTotal(newTaxTotal);
    setTotal(newSubtotal + newTaxTotal - discount);
  }, [quotationItems, discount]);

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
    setQuotationItems([
      ...quotationItems,
      {
        id: quotationItems.length,
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
    const newItems = [...quotationItems];
    newItems.splice(index, 1);
    setQuotationItems(newItems);
  };

  const handleItemChange = <K extends keyof QuotationItem>(
    index: number,
    field: K,
    value: QuotationItem[K],
  ) => {
    const newItems = [...quotationItems];
    newItems[index][field] = value;
    setQuotationItems(newItems);
  };

  const handleProductSelect = (product: Product, index: number) => {
    const newItems = [...quotationItems];
    newItems[index].product_id = product.id;
    newItems[index].product_name = product.name;
    newItems[index].description = product.description;
    newItems[index].unit_price = product.price;
    newItems[index].tax_rate = product.tax_rate || 0;
    setQuotationItems(newItems);
    setShowProductSearch(false);
  };

  const openProductSearch = (index: number) => {
    setActiveItemIndex(index);
    setShowProductSearch(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: quotation?.currency_code || defaultCurrency,
    }).format(amount);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const hasValidItems = quotationItems.some(
        (item) => item.description.trim() !== "",
      );
      if (!hasValidItems) {
        setError("Please add at least one item with a description");
        setIsSubmitting(false);
        return;
      }

      const formData = new FormData(formRef.current!);
      const supabase = createClient();

      // Update quotation
      const { error: quotationError } = await supabase
        .from("quotations")
        .update({
          customer_id: formData.get("customer_id"),
          issue_date: formData.get("issue_date"),
          valid_until: formData.get("valid_until"),
          currency_code: formData.get("currency_code"),
          status: formData.get("status"),
          notes: formData.get("notes"),
          terms_conditions: formData.get("terms_conditions"),
          discount_amount: discount,
          subtotal: subtotal,
          tax_amount: taxTotal,
          total_amount: total,
          updated_at: new Date().toISOString(),
        })
        .eq("id", quotationId);

      if (quotationError) {
        throw new Error(`Failed to update quotation: ${quotationError.message}`);
      }

      // Delete existing quotation items
      const { error: deleteError } = await supabase
        .from("quotation_items")
        .delete()
        .eq("quotation_id", quotationId);

      if (deleteError) {
        throw new Error(`Failed to delete existing items: ${deleteError.message}`);
      }

      // Insert updated quotation items
      const items = quotationItems
        .filter(item => item.description.trim() !== "")
        .map((item) => {
          const lineTotal = item.quantity * item.unit_price;
          const taxAmount = lineTotal * (item.tax_rate / 100);
          
          return {
            quotation_id: quotationId,
            product_id: item.product_id && item.product_id.trim() !== "" ? item.product_id : null,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            tax_rate: item.tax_rate,
            tax_amount: taxAmount,
            line_total: lineTotal,
          };
        });

      if (items.length > 0) {
        const { error: itemError } = await supabase
          .from("quotation_items")
          .insert(items);

        if (itemError) {
          throw new Error(`Failed to create quotation items: ${itemError.message}`);
        }
      }

      router.push(`/dashboard/quotations/${quotationId}`);
    } catch (error: any) {
      console.error("Error updating quotation:", error);
      setError("Failed to update quotation. Please check all fields and try again.");
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
            <div className="bg-card rounded-xl p-8 border shadow-sm flex justify-center">
              <p>Loading quotation...</p>
            </div>
          </div>
        </main>
      </>
    );
  }

  if (!quotation) {
    return (
      <>
        <DashboardNavbar />
        <main className="w-full">
          <div className="container mx-auto px-4 py-8">
            <div className="bg-card rounded-xl p-8 border shadow-sm text-center">
              <h2 className="text-2xl font-semibold mb-2">Quotation not found</h2>
              <p className="text-muted-foreground mb-4">
                The quotation you're trying to edit doesn't exist or you don't have permission to edit it.
              </p>
              <Link href="/dashboard/quotations">
                <Button>Back to Quotations</Button>
              </Link>
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
            <Link href={`/dashboard/quotations/${quotationId}`} className="mr-4">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Edit Quotation {quotation.quotation_number}</h1>
              <p className="text-muted-foreground">
                Update quotation details and items
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
              {/* Quotation Header */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="quotation_number">Quotation Number</Label>
                  <Input
                    id="quotation_number"
                    name="quotation_number"
                    value={quotation.quotation_number}
                    readOnly
                    className="bg-gray-50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customer_id">Customer *</Label>
                  <select
                    id="customer_id"
                    name="customer_id"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    defaultValue={quotation.customer_id}
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
                    defaultValue={quotation.currency_code}
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
                    defaultValue={quotation.issue_date}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="valid_until">Valid Until *</Label>
                  <Input
                    id="valid_until"
                    name="valid_until"
                    type="date"
                    defaultValue={quotation.valid_until}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <select
                    id="status"
                    name="status"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    defaultValue={quotation.status}
                  >
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="accepted">Accepted</option>
                    <option value="rejected">Rejected</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
              </div>

              {/* Quotation Items */}
              <div>
                <h3 className="text-lg font-medium mb-4">Quotation Items</h3>
                <div className="border rounded-md overflow-auto max-h-[500px]">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Item
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Quantity
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Unit Price
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Tax
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {quotationItems.map((item, index) => (
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
                              disabled={quotationItems.length === 1}
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

              {/* Quotation Totals and Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      name="notes"
                      placeholder="Additional notes for the customer"
                      rows={4}
                      defaultValue={quotation.notes || ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="terms_conditions">Terms & Conditions</Label>
                    <Textarea
                      id="terms_conditions"
                      name="terms_conditions"
                      placeholder="Terms and conditions for this quotation"
                      rows={4}
                      defaultValue={quotation.terms_conditions || ""}
                    />
                  </div>
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
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Link href={`/dashboard/quotations/${quotationId}`}>
                  <Button variant="outline" type="button">
                    Cancel
                  </Button>
                </Link>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Updating..." : "Update Quotation"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </>
  );
}