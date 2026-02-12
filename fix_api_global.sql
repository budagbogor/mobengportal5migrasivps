-- Create a table for global system settings
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Enable RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Allow public read access (so all users can fetch the API key)
CREATE POLICY "Enable read access for all users" ON system_settings FOR SELECT USING (true);

-- Allow public insert/update access (for Admin to save settings - in a real app this should be restricted to authenticated admins only)
-- For this MVP/Demo, we allow public write to simplify the admin saving process without complex auth role checks in SQL
CREATE POLICY "Enable write access for all users" ON system_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON system_settings FOR UPDATE USING (true);

-- Insert default row for Gemini API Key if not exists
INSERT INTO system_settings (key, value) VALUES ('gemini_api_key', '') ON CONFLICT (key) DO NOTHING;
