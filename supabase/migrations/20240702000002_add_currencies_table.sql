-- Create currencies table if it doesn't exist
CREATE TABLE IF NOT EXISTS currencies (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL
);

-- Insert default currencies
INSERT INTO currencies (code, name, symbol)
VALUES 
  ('HKD', 'Hong Kong Dollar', 'HK$'),
  ('USD', 'US Dollar', '$'),
  ('EUR', 'Euro', '€'),
  ('GBP', 'British Pound', '£'),
  ('JPY', 'Japanese Yen', '¥'),
  ('CNY', 'Chinese Yuan', '¥'),
  ('CAD', 'Canadian Dollar', 'C$'),
  ('AUD', 'Australian Dollar', 'A$'),
  ('SGD', 'Singapore Dollar', 'S$')
ON CONFLICT (code) DO NOTHING;