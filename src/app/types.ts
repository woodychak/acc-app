// types.ts (你可根據實際修改)
export type Invoice = {
  id: string;
  invoice_number: string;
  customer_id: string;
  currency_code: string;
  issue_date: string;
  due_date: string;
  status: string;
  tax_amount: number;
  subtotal: number;
  discount_amount: number;
  notes?: string;
  total_amount: number;
  payments: string;
  invoice_items: InvoiceItems[];
  customer: {
    name: string;
    email: string;
    address: string;
    phone: string;
  };
  customers: {
    name: string;
    email: string;
    address: string;
    phone: string;
  };
};

export interface InvoiceCustomer {
  name: string;
}

export interface InvoiceSelected {
  id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  total_amount: number;
  currency_code: string;
  status: string;
  customers?: InvoiceCustomer | null;
}

export type InvoiceItems = {
  id?: string | number;
  invoice_id?: string;
  product_id?: string | null;
  product_name?: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate?: number;
  tax_amount: number;
  line_total?: number;
  original_id?: string;
  product?: Product;
};

export type Product = {
  is_active: boolean;
  id: string;
  name: string;
  description: string;
  sku?: string;
  price: number;
  tax_rate?: number;
  currency_code?: string;
  vendor_id?: string | null;
  cost_price?: number;
};

export type Payment = {
  id: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  reference_number: string;
  currency_code: string;
  invoice_id: string;

  // Nested invoice object inside payment
  invoices?: {
    invoice_number: string;

    // customers is a single object, not an array
    customers?: {
      name: string;
    } | null;
  } | null; // invoices can be null if join fails
};

export type PaymentSelected = {
  id: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  reference_number: string;
  currency_code: string;
  invoice_id: string;

  // Nested invoice object inside payment
  invoices?: {
    invoice_number: string;

    // customers is a single object, not an array
    customers?: {
      name: string;
    } | null;
  } | null; // invoices can be null if join fails
};

export interface Customer {
  id: string;
  name: string;
  email?: string;
  address?: string;
}

export interface Customers {
  id: string;
  name: string;
  email?: string;
  address?: string;
}

export type CompanyProfile = {
  id: string;
  name: string;
  tel: string; // ✅ 確保有這個欄位
  address: string;
  contact: string;
  payment_terms: string;
  default_currency: string;
  prefix: string;
  bank_account: string;
  logo_url?: string;
  is_complete: boolean; // 確保這行有
  smtp_host?: string;
  smtp_port?: number;
  smtp_username?: string;
  smtp_password?: string;
  email_template?: string;
  user_id: string;
  // 更多欄位...
};

export type CustomerSummary = {
  id: string;
  name: string;
};

export type InvoiceWithCustomer = Invoice & {
  customers?: CustomerSummary; // 注意是 customers
};

export type Quotation = {
  id: string;
  quotation_number: string;
  customer_id: string;
  currency_code: string;
  issue_date: string;
  valid_until: string;
  status: string;
  tax_amount: number;
  subtotal: number;
  discount_amount: number;
  notes?: string;
  terms_conditions?: string;
  total_amount: number;
  converted_invoice_id?: string;
  quotation_items: QuotationItems[];
  customer: {
    name: string;
    email: string;
    address: string;
    phone: string;
  };
  customers: {
    name: string;
    email: string;
    address: string;
    phone: string;
  };
};

export type QuotationItems = {
  id?: string | number;
  quotation_id?: string;
  product_id?: string | null;
  product_name?: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate?: number;
  tax_amount: number;
  line_total?: number;
  original_id?: string;
  product?: Product;
};

export interface QuotationCustomer {
  name: string;
}

export interface QuotationSelected {
  id: string;
  quotation_number: string;
  issue_date: string;
  valid_until: string;
  total_amount: number;
  currency_code: string;
  status: string;
  customers?: QuotationCustomer | null;
}

export type Vendor = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  tax_id?: string | null;
  contact_person?: string | null;
  notes?: string | null;
  is_active?: boolean;
  created_at: string;
  updated_at: string;
  user_id: string;
};

export type PurchaseOrder = {
  id: string;
  po_number: string;
  vendor_id: string;
  customer_id?: string | null;
  quotation_id?: string | null;
  issue_date: string;
  expected_date?: string;
  currency_code: string;
  status: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  notes?: string;
  terms_conditions?: string;
  delivery_address?: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  purchase_order_items: PurchaseOrderItem[];
  vendor?: Vendor;
  vendors?: Vendor;
  customer?: Customer;
  customers?: Customer;
  quotation?: Quotation;
  quotations?: Quotation;
};

export type PurchaseOrderItem = {
  id?: string;
  purchase_order_id?: string;
  product_id?: string | null;
  product_name?: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate?: number;
  tax_amount?: number;
  line_total?: number;
  product?: Product;
};