-- 1. Create PROFILES table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'recruiter', -- 'super_admin' or 'recruiter'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Create Policies
-- Allow users to read their own profile
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);

-- Allow Super Admin/Recruiter to read all profiles (for Management) - Simplification: Allow Authenticated read
CREATE POLICY "Authenticated can read all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);

-- Allow updates only for self or admin (Simplified for now: Self Only)
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 4. Create Trigger to Auto-Create Profile on Signup
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name', 'recruiter');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger execution
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 5. Insert Dummy Data (OPTIONAL - ONLY IF YOU WANT TO TEST)
-- INSERT INTO public.profiles (id, email, role) VALUES ('some-uuid', 'admin@mobeng.co.id', 'super_admin');
