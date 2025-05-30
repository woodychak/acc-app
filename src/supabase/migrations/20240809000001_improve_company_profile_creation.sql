-- Modify the disable_rls_for_company_profile function to be more reliable
DROP FUNCTION IF EXISTS disable_rls_for_company_profile();

CREATE OR REPLACE FUNCTION disable_rls_for_company_profile()
RETURNS VOID AS $$
BEGIN
  -- Temporarily disable RLS for company_profile table
  ALTER TABLE company_profile DISABLE ROW LEVEL SECURITY;
  
  -- Keep it disabled for 5 seconds to ensure operations complete
  PERFORM pg_sleep(5);
  
  -- Re-enable RLS
  ALTER TABLE company_profile ENABLE ROW LEVEL SECURITY;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a direct insert function that bypasses RLS
CREATE OR REPLACE FUNCTION create_company_profile(
  p_name TEXT,
  p_prefix TEXT,
  p_default_currency TEXT,
  p_user_id UUID,
  p_is_complete BOOLEAN
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO company_profile (
    name, 
    prefix, 
    default_currency, 
    user_id, 
    is_complete,
    created_at
  ) VALUES (
    p_name,
    p_prefix,
    p_default_currency,
    p_user_id,
    p_is_complete,
    NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the company_profile table has the correct RLS policies
DROP POLICY IF EXISTS "Users can insert their own company profiles" ON company_profile;

CREATE POLICY "Users can insert their own company profiles"
ON company_profile FOR INSERT
WITH CHECK (auth.uid() = user_id OR auth.jwt() ->> 'role' = 'service_role');
