-- Add user_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_profile' AND column_name = 'user_id') THEN
    ALTER TABLE company_profile ADD COLUMN user_id UUID REFERENCES auth.users(id);
  END IF;
END $$;

-- Create function to temporarily disable RLS for company profile
CREATE OR REPLACE FUNCTION disable_rls_for_company_profile()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Temporarily disable RLS for company_profile table
  ALTER TABLE company_profile DISABLE ROW LEVEL SECURITY;
  
  -- Re-enable RLS after 1 second (enough time for the insert operation)
  PERFORM pg_sleep(1);
  ALTER TABLE company_profile ENABLE ROW LEVEL SECURITY;
  
  RETURN;
END;
$$;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own company profile" ON company_profile;
DROP POLICY IF EXISTS "Users can update their own company profile" ON company_profile;

-- Create policies for company_profile table
CREATE POLICY "Users can view their own company profile"
ON company_profile
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own company profile"
ON company_profile
FOR UPDATE
USING (auth.uid() = user_id);

-- Enable RLS on company_profile table
ALTER TABLE company_profile ENABLE ROW LEVEL SECURITY;
