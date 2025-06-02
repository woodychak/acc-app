-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  sku TEXT,
  price DECIMAL(15, 2) NOT NULL,
  currency_code TEXT NOT NULL DEFAULT 'USD',
  tax_rate DECIMAL(5, 2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT,
  tax_id TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create currencies table
CREATE TABLE IF NOT EXISTS currencies (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  decimal_places INTEGER NOT NULL DEFAULT 2,
  is_default BOOLEAN DEFAULT false,
  exchange_rate DECIMAL(15, 6) DEFAULT 1.0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number TEXT NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  subtotal DECIMAL(15, 2) NOT NULL,
  tax_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(15, 2) NOT NULL,
  currency_code TEXT REFERENCES currencies(code) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create invoice_items table
CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity DECIMAL(15, 2) NOT NULL,
  unit_price DECIMAL(15, 2) NOT NULL,
  tax_rate DECIMAL(5, 2) DEFAULT 0,
  tax_amount DECIMAL(15, 2) DEFAULT 0,
  discount_percentage DECIMAL(5, 2) DEFAULT 0,
  discount_amount DECIMAL(15, 2) DEFAULT 0,
  line_total DECIMAL(15, 2) NOT NULL
);

-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount DECIMAL(15, 2) NOT NULL,
  currency_code TEXT REFERENCES currencies(code) ON DELETE RESTRICT,
  payment_method TEXT NOT NULL,
  reference_number TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable realtime for all tables
alter publication supabase_realtime add table products;
alter publication supabase_realtime add table customers;
alter publication supabase_realtime add table currencies;
alter publication supabase_realtime add table invoices;
alter publication supabase_realtime add table invoice_items;
alter publication supabase_realtime add table payments;
