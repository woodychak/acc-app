-- Add SMTP columns to company_profile table if they don't exist
ALTER TABLE company_profile 
ADD COLUMN IF NOT EXISTS smtp_host TEXT,
ADD COLUMN IF NOT EXISTS smtp_port INTEGER,
ADD COLUMN IF NOT EXISTS smtp_username TEXT,
ADD COLUMN IF NOT EXISTS smtp_password TEXT,
ADD COLUMN IF NOT EXISTS email_template TEXT;

-- Enable realtime for company_profile table
alter publication supabase_realtime add table company_profile;
