-- Fix company profile constraints
ALTER TABLE company_profile DROP CONSTRAINT IF EXISTS company_profile_user_id_fkey;
