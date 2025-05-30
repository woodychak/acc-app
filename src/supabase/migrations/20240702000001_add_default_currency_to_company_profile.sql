-- Add default_currency column to company_profile table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'company_profile' 
                AND column_name = 'default_currency') THEN
    ALTER TABLE company_profile ADD COLUMN default_currency TEXT DEFAULT 'HKD';
  END IF;
END $$;