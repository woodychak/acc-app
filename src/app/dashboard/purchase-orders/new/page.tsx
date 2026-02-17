"use client";

import DashboardNavbar from "@/components/dashboard-navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, Trash2, Search } from "lucide-react";
import Link from "next/link";
import { createClient } from "../../../../../supabase/client";
import { createPurchaseOrderAction } from "../actions";
import { useEffect, useState, useRef, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Vendor, Quotation, Customer } from "@/app/types";

type POItem = {
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
  cost_price: number;
  tax_rate: number;
  description: string;
  vendor_id: string | null;
};

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const formRef = useRef(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [filteredQuotations, setFilteredQuotations] = useState<Quotation[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedQuotationId, setSelectedQuotationId] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [poItems, setPoItems] = useState<POItem[]>([
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
  const [nextPONumber, setNextPONumber] = useState("");

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showProductSearch) {
        const target = event.target as HTMLElement;
        if (!target.closest(".product-search-container")) {
          setShowProductSearch(false);
          setSearchTerm("");
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showProductSearch]);

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/sign-in";
        return;
      }

      // Fetch vendors
      const { data: vendorsData } = await supabase
        .from("vendors")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (vendorsData) {
        setVendors(vendorsData);
      }

      // Fetch customers
      const { data: customersData } = await supabase
        .from("customers")
        .select("*")
        .eq("user_id", user.id)
        .order("name", { ascending: true });

      if (customersData) {
        setCustomers(customersData);
      }

      // Fetch quotations
      const { data: quotationsData } = await supabase
        .from("quotations")
        .select("*, customers(name, address)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (quotationsData) {
        setQuotations(quotationsData as any);
        setFilteredQuotations(quotationsData as any);
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

      // Fetch currencies
      const { data: currenciesData } = await supabase
        .from("currencies")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("is_default", { ascending: false })
        .order("code", { ascending: true });

      setCurrencies(currenciesData || []);

      const defaultCurr =
        currenciesData?.find((c) => c.is_default)?.code || "HKD";
      setDefaultCurrency(defaultCurr);

      // Get latest PO number
      const { data: latestPO } = await supabase
        .from("purchase_orders")
        .select("po_number")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      let nextNumber = 1;
      const currentPrefix = "PO-";

      if (latestPO?.po_number) {
        const escapedPrefix = currentPrefix.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        );
        const regex = new RegExp(`^${escapedPrefix}(\\d+)`);
        const match = latestPO.po_number.match(regex);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }

      const generatedPONumber = `${currentPrefix}${String(nextNumber).padStart(4, "0")}`;
      setNextPONumber(generatedPONumber);
    };

    checkAuth();
  }, []);

  // Calculate totals
  useEffect(() => {
    let newSubtotal = 0;
    let newTaxTotal = 0;

    poItems.forEach((item) => {
      const lineTotal = item.quantity * item.unit_price;
      newSubtotal += lineTotal;
      if (item.tax_rate) {
        newTaxTotal += lineTotal * (item.tax_rate / 100);
      }
    });

    setSubtotal(newSubtotal);
    setTaxTotal(newTaxTotal);
    setTotal(newSubtotal + newTaxTotal - discount);
  }, [poItems, discount]);

  // Filter products based on search and vendor
  useEffect(() => {
    let filtered = products;

    // Filter by selected vendor if one is selected
    if (selectedVendorId) {
      filtered = filtered.filter(
        (p) => p.vendor_id === selectedVendorId || !p.vendor_id
      );
    }

    if (searchTerm.trim() !== "") {
      filtered = filtered.filter(
        (product) =>
          product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (product.sku &&
            product.sku.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    setFilteredProducts(filtered);
  }, [searchTerm, products, selectedVendorId]);

  // Filter quotations by selected customer
  useEffect(() => {
    if (selectedCustomerId) {
      const filtered = quotations.filter(
        (q) => q.customer_id === selectedCustomerId
      );
      setFilteredQuotations(filtered);
    } else {
      setFilteredQuotations(quotations);
    }
  }, [selectedCustomerId, quotations]);

  const handleCustomerChange = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setSelectedQuotationId("");
    const customer = customers.find((c) => c.id === customerId);
    if (customer?.address) {
      setDeliveryAddress(customer.address);
    }
  };

  const handleQuotationSelect = async (quotationId: string) => {
    setSelectedQuotationId(quotationId);
    if (!quotationId) return;

    const supabase = createClient();
    const { data: quotationData } = await supabase
      .from("quotations")
      .select("*, quotation_items(*), customers(address)")
      .eq("id", quotationId)
      .single();

    if (quotationData) {
      // Auto-populate delivery address from quotation's customer
      if (quotationData.customers?.address) {
        setDeliveryAddress(quotationData.customers.address);
      }

      if (quotationData.quotation_items) {
        // Fetch product cost prices
        const productIds = quotationData.quotation_items
          .map((item: any) => item.product_id)
          .filter((id: string) => id);
        
        let productCostPrices: Record<string, number> = {};
        
        if (productIds.length > 0) {
          const { data: productsData } = await supabase
            .from("products")
            .select("id, cost_price")
            .in("id", productIds);
          
          if (productsData) {
            productsData.forEach((product: any) => {
              productCostPrices[product.id] = product.cost_price || 0;
            });
          }
        }

        // Populate items from quotation, using cost price instead of selling price
        const items: POItem[] = quotationData.quotation_items.map(
          (item: any, index: number) => ({
            id: index,
            product_id: item.product_id || "",
            product_name: item.product_name || "",
            description: item.description || "",
            quantity: item.quantity || 1,
            // Use cost price from product, fallback to item's unit_price if product not found
            unit_price: item.product_id && productCostPrices[item.product_id] !== undefined 
              ? productCostPrices[item.product_id]
              : (item.unit_price || 0),
            tax_rate: item.tax_rate || 0,
          })
        );
        setPoItems(items.length > 0 ? items : [
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
      }
    }
  };

  const handleAddItem = () => {
    setPoItems([
      ...poItems,
      {
        id: poItems.length,
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
    const newItems = [...poItems];
    newItems.splice(index, 1);
    setPoItems(newItems);
  };

  const handleItemChange = <K extends keyof POItem>(
    index: number,
    field: K,
    value: POItem[K]
  ) => {
    const newItems = [...poItems];
    newItems[index][field] = value;
    setPoItems(newItems);
  };

  const handleProductSelect = (product: Product, index: number) => {
    const newItems = [...poItems];
    newItems[index].product_id = product.id;
    newItems[index].product_name = product.name;
    newItems[index].description = product.description || "";
    // Use cost_price for PO instead of selling price
    newItems[index].unit_price = product.cost_price || product.price;
    newItems[index].tax_rate = product.tax_rate || 0;
    setPoItems([...newItems]); // Force re-render with new array reference
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
      const hasValidItems = poItems.some(
        (item) => item.description.trim() !== ""
      );
      if (!hasValidItems) {
        setError("Please add at least one item with a description");
        setIsSubmitting(false);
        return;
      }

      const formData = new FormData(formRef.current!);

      formData.set("subtotal", subtotal.toString());
      formData.set("tax_amount", taxTotal.toString());
      formData.set("total_amount", total.toString());

      const result = await createPurchaseOrderAction(formData);
      router.push("/dashboard/purchase-orders");
    } catch (error) {
      console.error("Error submitting PO:", error);
      setError(
        "Failed to create purchase order. Please check all fields and try again."
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
            <Link href="/dashboard/purchase-orders" className="mr-4">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Create Purchase Order</h1>
              <p className="text-muted-foreground">
                Generate a new purchase order for a vendor
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
              {/* PO Header */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="po_number">PO Number *</Label>
                  <Input
                    id="po_number"
                    name="po_number"
                    value={nextPONumber}
                    readOnly
                    className="bg-gray-50"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Auto-generated PO number
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vendor_id">Vendor *</Label>
                  <select
                    id="vendor_id"
                    name="vendor_id"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    required
                    onChange={(e) => setSelectedVendorId(e.target.value)}
                  >
                    <option value="">Select a vendor</option>
                    {vendors?.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customer_id">Client (For Delivery)</Label>
                  <select
                    id="customer_id"
                    name="customer_id"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={selectedCustomerId}
                    onChange={(e) => handleCustomerChange(e.target.value)}
                  >
                    <option value="">Select a client</option>
                    {customers?.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quotation_id">Import from Quotation</Label>
                  <select
                    id="quotation_id"
                    name="quotation_id"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={selectedQuotationId}
                    onChange={(e) => handleQuotationSelect(e.target.value)}
                  >
                    <option value="">Select quotation (optional)</option>
                    {filteredQuotations?.map((quotation) => (
                      <option key={quotation.id} value={quotation.id}>
                        {quotation.quotation_number} - {quotation.customers?.name || "N/A"}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Populate items from an existing quotation
                  </p>
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
                  <Label htmlFor="expected_date">Expected Delivery Date</Label>
                  <Input
                    id="expected_date"
                    name="expected_date"
                    type="date"
                    defaultValue={
                      new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
                        .toISOString()
                        .split("T")[0]
                    }
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
                    <option value="confirmed">Confirmed</option>
                    <option value="received">Received</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                <div className="space-y-2 md:col-span-3">
                  <Label htmlFor="delivery_address">Delivery Address</Label>
                  <Textarea
                    id="delivery_address"
                    name="delivery_address"
                    placeholder="Delivery address for this purchase order"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    rows={2}
                  />
                </div>
              </div>

              {/* PO Items */}
              <div>
                <h3 className="text-lg font-medium mb-4">Order Items</h3>
                <div className="border rounded-md overflow-visible">
                  <div className="overflow-auto max-h-[500px]">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0 z-10">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Item
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Quantity
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Unit Cost
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
                        {poItems.map((item, index) => (
                          <tr key={item.id}>
                            <td className="px-6 py-4 relative product-search-container">
                              <div className="space-y-2">
                                <Input
                                  name={`items[${index}][product_name]`}
                                  placeholder="Product name"
                                  value={item.product_name || ""}
                                  onChange={(e) =>
                                    handleItemChange(
                                      index,
                                      "product_name",
                                      e.target.value
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
                                        e.target.value
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

                              {showProductSearch &&
                                activeItemIndex === index && (
                                  <div className="fixed z-[9999] mt-1 w-96 bg-white border rounded-md shadow-2xl max-h-96 overflow-auto">
                                    <div className="p-2 sticky top-0 bg-white border-b z-10">
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
                                              Cost:{" "}
                                              {formatCurrency(
                                                product.cost_price ||
                                                  product.price
                                              )}
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
                                    parseInt(e.target.value) || 1
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
                                    parseFloat(e.target.value) || 0
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
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                className="w-20"
                              />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium">
                                {formatCurrency(
                                  item.quantity * item.unit_price
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Button
                                variant="ghost"
                                size="icon"
                                type="button"
                                onClick={() => handleRemoveItem(index)}
                                disabled={poItems.length === 1}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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

              {/* Totals and Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      name="notes"
                      placeholder="Additional notes for the vendor"
                      rows={4}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="terms_conditions">
                      Terms & Conditions
                    </Label>
                    <Textarea
                      id="terms_conditions"
                      name="terms_conditions"
                      placeholder="Terms and conditions for this PO"
                      rows={4}
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

                  <input type="hidden" name="subtotal" value={subtotal} />
                  <input type="hidden" name="tax_amount" value={taxTotal} />
                  <input type="hidden" name="total_amount" value={total} />
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Link href="/dashboard/purchase-orders">
                  <Button variant="outline" type="button">
                    Cancel
                  </Button>
                </Link>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Save Purchase Order"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </>
  );
}
