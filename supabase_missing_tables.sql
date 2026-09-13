-- ============================================================
-- FarmPilot — Missing Tables (run this in Supabase SQL Editor)
-- These are required for login and signup to work
-- ============================================================

-- ============================================================
-- 1. USERS (profile created immediately after signup)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email       TEXT,
  name        TEXT,
  photo_url   TEXT,
  role        TEXT DEFAULT 'user',
  provider    TEXT DEFAULT 'email',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_owner_all" ON public.users
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ============================================================
-- 2. SETTINGS (created immediately after signup)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.settings (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  notifications    JSONB DEFAULT '{}'::jsonb,
  auth_settings    JSONB DEFAULT '{"otpMethod":"email","requireAuthForEdits":true}'::jsonb,
  visual_effects   JSONB DEFAULT '{}'::jsonb,
  theme            TEXT DEFAULT 'light',
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_owner_all" ON public.settings
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ============================================================
-- 3. BROADCASTS (admin announcements shown in Layout)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.broadcasts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title       TEXT,
  message     TEXT,
  type        TEXT DEFAULT 'info',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
-- Everyone can read broadcasts
CREATE POLICY "broadcasts_public_select" ON public.broadcasts
  FOR SELECT USING (TRUE);

-- Enable realtime on new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
ALTER PUBLICATION supabase_realtime ADD TABLE public.settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.broadcasts;

-- ============================================================
-- Done! Run the original migration first, then this one.
-- ============================================================
