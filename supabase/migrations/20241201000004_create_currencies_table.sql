CREATE TABLE IF NOT EXISTS currencies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  code VARCHAR(3) NOT NULL,
  name VARCHAR(100) NOT NULL,
  symbol VARCHAR(10) NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, code)
);

-- Insert default currencies for all existing users
INSERT INTO currencies (user_id, code, name, symbol, is_default, is_active)
SELECT 
  u.id,
  'HKD',
  'Hong Kong Dollar',
  'HK$',
  true,
  true
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM currencies c WHERE c.user_id = u.id AND c.code = 'HKD'
);

-- Insert common currencies for all existing users
INSERT INTO currencies (user_id, code, name, symbol, is_default, is_active)
SELECT 
  u.id,
  unnest(ARRAY['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'CAD', 'AUD', 'SGD']),
  unnest(ARRAY['US Dollar', 'Euro', 'British Pound', 'Japanese Yen', 'Chinese Yuan', 'Canadian Dollar', 'Australian Dollar', 'Singapore Dollar']),
  unnest(ARRAY['$', '€', '£', '¥', '¥', 'C$', 'A$', 'S$']),
  false,
  true
FROM auth.users u;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE currencies;

-- Create RLS policies
ALTER TABLE currencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own currencies"
ON currencies FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own currencies"
ON currencies FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own currencies"
ON currencies FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own currencies"
ON currencies FOR DELETE
USING (auth.uid() = user_id);

-- Function to ensure only one default currency per user
CREATE OR REPLACE FUNCTION ensure_single_default_currency()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = TRUE THEN
    UPDATE currencies 
    SET is_default = FALSE 
    WHERE user_id = NEW.user_id AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ensure_single_default_currency
  BEFORE INSERT OR UPDATE ON currencies
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_default_currency();