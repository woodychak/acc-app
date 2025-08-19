-- Add new SMTP security and sender fields to company_profile table
ALTER TABLE company_profile 
ADD COLUMN IF NOT EXISTS smtp_secure TEXT,
ADD COLUMN IF NOT EXISTS smtp_sender TEXT;

-- Add comments for the new fields
COMMENT ON COLUMN company_profile.smtp_secure IS 'SMTP security protocol: TLS, SSL, or NONE';
COMMENT ON COLUMN company_profile.smtp_sender IS 'Custom sender email address for SMTP (optional)';
