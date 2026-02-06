

-- JALANKAN KODE INI DI SUPABASE SQL EDITOR --

-- UPDATE SCHEMA (Jika tabel sudah ada, jalankan baris ALTER TABLE ini saja)
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS chat_history JSONB;

-- 1. Tabel untuk menyimpan hasil tes kandidat
CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY,
  candidate_name TEXT NOT NULL,
  candidate_phone TEXT NOT NULL,
  role TEXT NOT NULL,
  logic_score NUMERIC,
  culture_fit_score NUMERIC,
  status TEXT,
  
  -- Menyimpan data kompleks (Profile lengkap, Scores, Psychometrics) sebagai JSON
  profile_data JSONB,
  simulation_scores JSONB,
  psychometrics JSONB,
  final_summary TEXT,
  cheat_count INTEGER DEFAULT 0,
  
  -- ADDED: Kolom untuk menyimpan riwayat chat
  chat_history JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Tabel untuk mencatat token undangan yang sudah terpakai
CREATE TABLE IF NOT EXISTS used_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token_id TEXT NOT NULL UNIQUE,
  used_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Mengaktifkan Row Level Security (RLS) - Optional tapi disarankan
-- Untuk demo ini, kita izinkan akses public (anon) untuk insert/select agar tidak perlu setup Auth user login
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE used_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Izinkan siapa saja (anonim) untuk Insert data (Kandidat submit tes)
CREATE POLICY "Enable insert for anon" ON submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for anon tokens" ON used_tokens FOR INSERT WITH CHECK (true);

-- Policy: Izinkan siapa saja membaca (untuk Dashboard Recruiter - Idealnya diproteksi Auth, tapi untuk demo kita buka)
CREATE POLICY "Enable select for anon" ON submissions FOR SELECT USING (true);
CREATE POLICY "Enable select for anon tokens" ON used_tokens FOR SELECT USING (true);