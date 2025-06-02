-- Remove NOT NULL constraint from id column if it exists
ALTER TABLE company_profile ALTER COLUMN id DROP NOT NULL;

-- Add a default value for id if it doesn't have one
ALTER TABLE company_profile ALTER COLUMN id SET DEFAULT nextval('company_profile_id_seq');

-- Make sure the sequence exists
CREATE SEQUENCE IF NOT EXISTS company_profile_id_seq;

-- Make sure user_id is indexed
CREATE INDEX IF NOT EXISTS idx_company_profile_user_id ON company_profile(user_id);
