-- Add columns for multiple receipts to expenses table
ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS receipt_url TEXT,
ADD COLUMN IF NOT EXISTS receipt_filename TEXT,
ADD COLUMN IF NOT EXISTS receipt_urls TEXT[],
ADD COLUMN IF NOT EXISTS receipt_filenames TEXT[],
ADD COLUMN IF NOT EXISTS ai_extracted_data JSONB;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON expenses(expense_date);