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
  is_active: boolean;  // 加這行
  id: string;
  name: string;
  description: string;
  sku?: string;
  price: number;
  tax_rate?: number;
  currency_code?: string;

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
  invoices: {
    invoice_number: string;

    // Again plural customers per your select()
    customers: {
      name: string;
    };
  } | null;  // invoices can be null if join fails
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
  invoices: {
    invoice_number: string;

    // Again plural customers per your select()
    customers: {
      name: string;
    };
  } | null;  // invoices can be null if join fails
};

export interface Customer  {
  id: string;
  name: string;
  email?: string;
  address?: string;
  
};

export interface Customers  {
  id: string;
  name: string;
  email?: string;
  address?: string;
  
};


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
  // 更多欄位...
};

export type CustomerSummary = {
  id: string;
  name: string;
};

export type InvoiceWithCustomer = Invoice & {
  customers?: CustomerSummary; // 注意是 customers
};

