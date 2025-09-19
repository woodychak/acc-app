-- Create company_profiles table (note: using plural form to match the error)
CREATE TABLE IF NOT EXISTS company_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  company_address TEXT,
  company_phone TEXT,
  company_email TEXT,
  company_website TEXT,
  tax_id TEXT,
  registration_number TEXT,
  default_currency TEXT DEFAULT 'USD',
  invoice_prefix TEXT DEFAULT 'INV',
  quotation_prefix TEXT DEFAULT 'QUO',
  bank_account_name TEXT,
  bank_account_number TEXT,
  bank_name TEXT,
  bank_swift_code TEXT,
  smtp_host TEXT,
  smtp_port INTEGER,
  smtp_username TEXT,
  smtp_password TEXT,
  smtp_from_email TEXT,
  smtp_from_name TEXT,
  smtp_security TEXT DEFAULT 'tls',
  smtp_auth_required BOOLEAN DEFAULT true,
  quotation_email_template TEXT DEFAULT 'Dear {{customer_name}},

Please find attached your quotation {{quotation_number}}.

Thank you for your business.

Best regards,
{{company_name}}',
  is_complete BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_company_profiles_user_id ON company_profiles(user_id);

-- Enable realtime
alter publication supabase_realtime add table company_profiles;

-- Create RLS policies
ALTER TABLE company_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own company profile" ON company_profiles;
CREATE POLICY "Users can view own company profile"
ON company_profiles FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own company profile" ON company_profiles;
CREATE POLICY "Users can insert own company profile"
ON company_profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own company profile" ON company_profiles;
CREATE POLICY "Users can update own company profile"
ON company_profiles FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own company profile" ON company_profiles;
CREATE POLICY "Users can delete own company profile"
ON company_profiles FOR DELETE
USING (auth.uid() = user_id);