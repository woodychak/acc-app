-- Add prefix and bank_account columns to company_profile table if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'company_profile' 
                AND column_name = 'prefix') THEN
    ALTER TABLE company_profile ADD COLUMN prefix TEXT DEFAULT 'INV-';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'company_profile' 
                AND column_name = 'bank_account') THEN
    ALTER TABLE company_profile ADD COLUMN bank_account TEXT;
  END IF;
END $$;