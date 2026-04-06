-- Add Cook County-specific property tax rate
-- Cook County effective residential tax rate is ~2.2% of market value
-- vs. the national default of 1.5%
INSERT INTO system_defaults (key, value, label, category)
VALUES ('cook_county_tax_rate', 0.0220, 'Cook County Annual Property Tax Rate', 'expense')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
