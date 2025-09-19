-- Add quotation email template column to company_profile table
ALTER TABLE company_profile 
ADD COLUMN IF NOT EXISTS quotation_email_template TEXT;