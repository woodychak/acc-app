-- Check if user_id column exists in company_profile table
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_profile' AND column_name = 'user_id') THEN
    ALTER TABLE company_profile ADD COLUMN user_id UUID REFERENCES auth.users(id);
  END IF;
END $$;

-- Update RLS policies for company_profile table
ALTER TABLE company_profile ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own company profile" ON company_profile;
DROP POLICY IF EXISTS "Users can update their own company profile" ON company_profile;

-- Create new policies
CREATE POLICY "Users can view their own company profile"
ON company_profile FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own company profile"
ON company_profile FOR UPDATE
USING (auth.uid() = user_id);
