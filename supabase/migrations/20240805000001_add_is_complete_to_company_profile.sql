-- Add is_complete column to company_profile table
ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS is_complete BOOLEAN DEFAULT FALSE;

-- Update existing records to mark them as complete
UPDATE company_profile SET is_complete = TRUE WHERE name IS NOT NULL AND name != '';
