-- Ensure default currencies exist for all users
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
)
ON CONFLICT (user_id, code) DO NOTHING;

-- Insert other common currencies for all existing users
INSERT INTO currencies (user_id, code, name, symbol, is_default, is_active)
SELECT 
  u.id,
  c.code,
  c.name,
  c.symbol,
  false,
  true
FROM auth.users u
CROSS JOIN (
  VALUES 
    ('USD', 'US Dollar', '$'),
    ('EUR', 'Euro', '€'),
    ('GBP', 'British Pound', '£'),
    ('JPY', 'Japanese Yen', '¥'),
    ('CNY', 'Chinese Yuan', '¥'),
    ('CAD', 'Canadian Dollar', 'C$'),
    ('AUD', 'Australian Dollar', 'A$'),
    ('SGD', 'Singapore Dollar', 'S$')
) AS c(code, name, symbol)
WHERE NOT EXISTS (
  SELECT 1 FROM currencies curr WHERE curr.user_id = u.id AND curr.code = c.code
)
ON CONFLICT (user_id, code) DO NOTHING;