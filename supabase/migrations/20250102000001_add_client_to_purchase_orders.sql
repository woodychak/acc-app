-- Add customer_id, quotation_id, and delivery_address to purchase_orders table
ALTER TABLE purchase_orders 
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quotation_id UUID REFERENCES quotations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_address TEXT;
