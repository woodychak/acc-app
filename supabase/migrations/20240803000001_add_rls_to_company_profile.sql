-- First ensure the user_id column exists in company_profile table
ALTER TABLE IF EXISTS company_profile 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Enable Row Level Security on company_profile table
ALTER TABLE company_profile ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to see only their own company profile
DROP POLICY IF EXISTS "Users can view their own company profile" ON company_profile;
CREATE POLICY "Users can view their own company profile"
ON company_profile FOR SELECT
USING (auth.uid() = user_id);

-- Create policy to allow users to update only their own company profile
DROP POLICY IF EXISTS "Users can update their own company profile" ON company_profile;
CREATE POLICY "Users can update their own company profile"
ON company_profile FOR UPDATE
USING (auth.uid() = user_id);

-- Create policy to allow users to insert their own company profile
DROP POLICY IF EXISTS "Users can insert their own company profile" ON company_profile;
CREATE POLICY "Users can insert their own company profile"
ON company_profile FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Add realtime support
alter publication supabase_realtime add table company_profile;
