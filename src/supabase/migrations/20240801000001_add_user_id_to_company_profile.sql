-- Add user_id column to company_profile table if it doesn't exist
ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_company_profile_user_id ON company_profile(user_id);
