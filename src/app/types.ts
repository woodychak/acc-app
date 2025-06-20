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
  invoice_items: InvoiceItems[];
  customer: {
    name: string;
    email: string;
    address: string;
    phone: string;
    
  };
};

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

export type Customer = {
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