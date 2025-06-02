-- Drop existing RLS policies for company_profile table
DROP POLICY IF EXISTS "Users can view their own company profiles" ON company_profile;
DROP POLICY IF EXISTS "Users can update their own company profiles" ON company_profile;
DROP POLICY IF EXISTS "Admin can manage all company profiles" ON company_profile;

-- Create a function to disable RLS temporarily for company profile creation
CREATE OR REPLACE FUNCTION disable_rls_for_company_profile()
RETURNS VOID AS $$
BEGIN
  -- Temporarily disable RLS for company_profile table
  ALTER TABLE company_profile DISABLE ROW LEVEL SECURITY;
  -- Re-enable RLS after 1 second (to allow the operation to complete)
  PERFORM pg_sleep(1);
  ALTER TABLE company_profile ENABLE ROW LEVEL SECURITY;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create proper RLS policies for company_profile table
CREATE POLICY "Users can view their own company profiles"
ON company_profile FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own company profiles"
ON company_profile FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own company profiles"
ON company_profile FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Allow service role to bypass RLS
CREATE POLICY "Service role can manage all company profiles"
ON company_profile
USING (auth.jwt() ->> 'role' = 'service_role');

-- Enable RLS on company_profile table
ALTER TABLE company_profile ENABLE ROW LEVEL SECURITY;
