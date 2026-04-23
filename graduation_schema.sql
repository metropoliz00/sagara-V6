-- SAGARA Graduation Schema Update
-- Run this in the Supabase SQL Editor if data is not saving correctly

-- 1. Ensure Graduates Table uses TEXT for ID to support NIS-based lookups
CREATE TABLE IF NOT EXISTS public.graduates (
    id TEXT PRIMARY KEY,
    nisn TEXT,
    name TEXT NOT NULL,
    ijazah_number TEXT,
    status TEXT,
    graduation_year TEXT,
    continued_to TEXT,
    created_at BIGINT,
    updated_at BIGINT
);

-- 2. Add RLS Policies for Graduates
ALTER TABLE public.graduates ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users full access
DROP POLICY IF EXISTS "Enable all access for all users" ON public.graduates;
CREATE POLICY "Enable all access for all users" ON public.graduates
AS PERMISSIVE FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- 3. Ensure profiles table exists for settings
CREATE TABLE IF NOT EXISTS public.profiles (
    id TEXT PRIMARY KEY, -- 'school' or 'teacher'
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.profiles;
CREATE POLICY "Enable all access for all users" ON public.profiles
AS PERMISSIVE FOR ALL
TO public
USING (true)
WITH CHECK (true);
