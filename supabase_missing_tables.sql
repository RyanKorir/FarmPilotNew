-- ============================================================
-- FarmPilot — Missing Tables Fix (v2)
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ============================================================
-- 1. USERS
-- ============================================================
DROP TABLE IF EXISTS public.users CASCADE;

CREATE TABLE IF NOT EXISTS public.users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT,
  name        TEXT,
  photo_url   TEXT,
  role        TEXT DEFAULT 'user',
  provider    TEXT DEFAULT 'email',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "users_insert_own" ON public.users
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (id = auth.uid());

-- ============================================================
-- 2. SETTINGS
-- ============================================================
DROP TABLE IF EXISTS public.settings CASCADE;

CREATE TABLE IF NOT EXISTS public.settings (
  id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  notifications    JSONB DEFAULT '{}'::jsonb,
  auth_settings    JSONB DEFAULT '{"otpMethod":"email","requireAuthForEdits":true}'::jsonb,
  visual_effects   JSONB DEFAULT '{}'::jsonb,
  theme            TEXT DEFAULT 'light',
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings_select_own" ON public.settings
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "settings_insert_own" ON public.settings
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "settings_update_own" ON public.settings
  FOR UPDATE USING (id = auth.uid());

-- ============================================================
-- 3. BROADCASTS
-- ============================================================
DROP TABLE IF EXISTS public.broadcasts CASCADE;

CREATE TABLE IF NOT EXISTS public.broadcasts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title       TEXT,
  message     TEXT,
  type        TEXT DEFAULT 'info',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "broadcasts_public_select" ON public.broadcasts
  FOR SELECT USING (TRUE);

-- ============================================================
-- Realtime
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
ALTER PUBLICATION supabase_realtime ADD TABLE public.settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.broadcasts;

-- ============================================================
-- Done!
-- ============================================================
