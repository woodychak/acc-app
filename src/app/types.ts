// types.ts (你可根據實際修改)
export type Invoice = {
  id: string;
  invoice_number: string;
  customer_id: string;
  currency_code: string;
  issue_date: string;
  due_date: string;
  status: string;
  notes?: string;
  total_amount?: number;
  customer: {
    name: string;
  };
};

export type InvoiceItems = {
  id?: string | number;
  invoice_id?: string;
  product_id?: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate?: number;
  tax_amount?: number;
  line_total?: number;
  original_id?: string;
};

export type Product = {
  is_active: boolean;  // 加這行
  id: string;
  name: string;
  sku?: string;
  price: number;
  tax_rate?: number;
  currency_code?: string;

};

export type Customer = {
  id: string;
  name: string;
};

export type CompanyProfile = {
  id: string;
  name: string;
  address?: string;
  is_complete?: boolean;
  bank_account?: string;
  default_currency?: string; // 確保這行有
  // 更多欄位...
};

export type CustomerSummary = {
  id: string;
  name: string;
};

export type InvoiceWithCustomer = Invoice & {
  customers?: CustomerSummary; // 注意是 customers
};