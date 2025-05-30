-- Create a function to confirm a user's email
CREATE OR REPLACE FUNCTION confirm_user(user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE auth.users
  SET email_confirmed_at = NOW(),
      is_sso_user = FALSE,
      confirmed_at = NOW()
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to the service role
GRANT EXECUTE ON FUNCTION confirm_user TO service_role;
