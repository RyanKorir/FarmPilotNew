-- ============================================================
-- FarmPilot — Supabase Migration Script
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Enable the UUID extension (already on by default in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. FARMS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.farms (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  location      TEXT,
  description   TEXT,
  is_default    BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.farms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "farms_owner_all" ON public.farms
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- ============================================================
-- 2. LIVESTOCK (groups)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.livestock (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  farm_id           UUID REFERENCES public.farms(id) ON DELETE CASCADE,
  type              TEXT NOT NULL,
  count             INTEGER NOT NULL DEFAULT 0,
  age_group         TEXT,
  health_status     TEXT DEFAULT 'Healthy',
  last_updated      TIMESTAMPTZ DEFAULT NOW(),
  notes             TEXT,
  registered_count  INTEGER DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.livestock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "livestock_owner_all" ON public.livestock
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- ============================================================
-- 3. INDIVIDUAL LIVESTOCK
-- ============================================================
CREATE TABLE IF NOT EXISTS public.individual_livestock (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  farm_id                 UUID REFERENCES public.farms(id) ON DELETE CASCADE,
  group_id                UUID REFERENCES public.livestock(id) ON DELETE SET NULL,
  name                    TEXT NOT NULL,
  tag_id                  TEXT,
  type                    TEXT,
  species                 TEXT,
  gender                  TEXT DEFAULT 'Female',
  dob                     TEXT,
  age_group               TEXT,
  breed                   TEXT,
  health_status           TEXT DEFAULT 'Healthy',
  physical_description    TEXT,
  color                   TEXT,
  mother_id               UUID,
  father_id               UUID,
  breeder_info            TEXT,
  source                  TEXT,
  date_acquired           TEXT,
  date_registered         TEXT,
  initial_weight          NUMERIC,
  purchase_price          NUMERIC,
  feed_schedule           JSONB,
  notes                   TEXT,
  next_vaccination_date   TEXT,
  sale_date               TEXT,
  death_date              TEXT,
  status                  TEXT DEFAULT 'active',
  registration_progress   INTEGER DEFAULT 0,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.individual_livestock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "individual_livestock_owner_all" ON public.individual_livestock
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- ============================================================
-- 4. ANIMAL HEALTH RECORDS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.animal_health (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  animal_id       UUID NOT NULL REFERENCES public.individual_livestock(id) ON DELETE CASCADE,
  type            TEXT NOT NULL DEFAULT 'Check-up',
  date            TEXT NOT NULL,
  diagnosis       TEXT,
  treatment       TEXT,
  medication      TEXT,
  veterinarian    TEXT,
  body_condition  TEXT,
  follow_up_date  TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.animal_health ENABLE ROW LEVEL SECURITY;
CREATE POLICY "animal_health_owner_all" ON public.animal_health
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- ============================================================
-- 5. ANIMAL VACCINATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.animal_vaccinations (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  animal_id         UUID NOT NULL REFERENCES public.individual_livestock(id) ON DELETE CASCADE,
  vaccine_name      TEXT NOT NULL,
  date_given        TEXT NOT NULL,
  next_due_date     TEXT,
  administered_by   TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.animal_vaccinations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "animal_vaccinations_owner_all" ON public.animal_vaccinations
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- ============================================================
-- 6. ANIMAL BREEDING RECORDS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.animal_breeding (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id                  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  animal_id                 UUID NOT NULL REFERENCES public.individual_livestock(id) ON DELETE CASCADE,
  mating_date               TEXT NOT NULL,
  bull_id                   UUID,
  pregnancy_check_result    TEXT DEFAULT 'Pending',
  expected_calving_date     TEXT,
  actual_calving_date       TEXT,
  complications             TEXT,
  calves                    JSONB,
  created_at                TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.animal_breeding ENABLE ROW LEVEL SECURITY;
CREATE POLICY "animal_breeding_owner_all" ON public.animal_breeding
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- ============================================================
-- 7. ANIMAL PRODUCTION LOGS (per-animal: milk, eggs, wool)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.animal_production (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  animal_id   UUID NOT NULL REFERENCES public.individual_livestock(id) ON DELETE CASCADE,
  date        TEXT NOT NULL,
  type        TEXT NOT NULL,
  quantity    NUMERIC NOT NULL DEFAULT 0,
  unit        TEXT DEFAULT 'Liters',
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.animal_production ENABLE ROW LEVEL SECURITY;
CREATE POLICY "animal_production_owner_all" ON public.animal_production
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- ============================================================
-- 8. ANIMAL WEIGHT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.animal_weight_logs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  animal_id         UUID NOT NULL REFERENCES public.individual_livestock(id) ON DELETE CASCADE,
  date              TEXT NOT NULL,
  weight            NUMERIC NOT NULL,
  growth_rate       NUMERIC,
  condition_score   INTEGER,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.animal_weight_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "animal_weight_logs_owner_all" ON public.animal_weight_logs
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- ============================================================
-- 9. PRODUCTION (farm-level: bulk milk/eggs/honey etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.production (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  farm_id     UUID REFERENCES public.farms(id) ON DELETE CASCADE,
  animal_id   UUID,
  type        TEXT NOT NULL,
  quantity    NUMERIC NOT NULL DEFAULT 0,
  unit        TEXT DEFAULT 'Liters',
  date        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.production ENABLE ROW LEVEL SECURITY;
CREATE POLICY "production_owner_all" ON public.production
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- ============================================================
-- 10. INVENTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inventory (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  farm_id         UUID REFERENCES public.farms(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  category        TEXT DEFAULT 'Feed',
  quantity        NUMERIC NOT NULL DEFAULT 0,
  unit            TEXT DEFAULT 'kg',
  min_threshold   NUMERIC DEFAULT 10,
  batch_number    TEXT,
  supplier        TEXT,
  expiry_date     TEXT,
  last_updated    TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inventory_owner_all" ON public.inventory
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- ============================================================
-- 11. INVENTORY HISTORY (sub-collection → inventory_history)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inventory_history (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventory_id    UUID NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
  old_quantity    NUMERIC,
  new_quantity    NUMERIC,
  change          NUMERIC,
  reason          TEXT,
  updated_by      TEXT,
  timestamp       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.inventory_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inventory_history_owner_all" ON public.inventory_history
  USING (
    EXISTS (
      SELECT 1 FROM public.inventory i
      WHERE i.id = inventory_id
        AND i.owner_id = auth.uid()
    )
  );

-- ============================================================
-- 12. TRANSACTIONS (finance)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.transactions (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  farm_id                 UUID REFERENCES public.farms(id) ON DELETE CASCADE,
  type                    TEXT NOT NULL DEFAULT 'expense',
  category                TEXT NOT NULL,
  amount                  NUMERIC NOT NULL DEFAULT 0,
  description             TEXT,
  date                    TEXT NOT NULL,
  related_inventory_id    UUID,
  related_livestock_id    UUID,
  quantity                NUMERIC,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transactions_owner_all" ON public.transactions
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- ============================================================
-- 13. ACTIVITY LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  farm_id       UUID,
  type          TEXT,
  entity_id     UUID,
  entity_name   TEXT,
  action        TEXT,
  details       TEXT,
  timestamp     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activity_logs_owner_all" ON public.activity_logs
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- ============================================================
-- 14. FEEDBACK
-- ============================================================
CREATE TABLE IF NOT EXISTS public.feedback (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name               TEXT,
  user_email              TEXT,
  category                TEXT,
  subject                 TEXT,
  message                 TEXT NOT NULL,
  screenshot              TEXT,
  ai_summary              TEXT,
  urgency                 TEXT,
  status                  TEXT DEFAULT 'pending',
  recipient_email         TEXT,
  is_verified_submission  BOOLEAN DEFAULT TRUE,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feedback_owner_insert" ON public.feedback
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "feedback_owner_select" ON public.feedback
  FOR SELECT USING (user_id = auth.uid());

-- ============================================================
-- 15. SYSTEM NOTIFICATIONS (for reminders)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.system_notifications (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_email      TEXT,
  subject           TEXT,
  body              TEXT,
  type              TEXT DEFAULT 'schedule_reminder',
  status            TEXT DEFAULT 'pending',
  reminders_count   INTEGER DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.system_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "system_notifications_owner_all" ON public.system_notifications
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 16. LEADERBOARD (Maasai Runner mini-game)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.leaderboard (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         TEXT NOT NULL UNIQUE,
  user_name       TEXT,
  score           INTEGER DEFAULT 0,
  level           INTEGER DEFAULT 1,
  total_coins     INTEGER DEFAULT 0,
  character_id    TEXT,
  upgrades        JSONB,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.leaderboard ENABLE ROW LEVEL SECURITY;
-- Anyone can read leaderboard (public high scores)
CREATE POLICY "leaderboard_public_select" ON public.leaderboard
  FOR SELECT USING (TRUE);
-- Only owner can write their own row
CREATE POLICY "leaderboard_owner_write" ON public.leaderboard
  FOR ALL USING (user_id = auth.uid()::TEXT)
  WITH CHECK (user_id = auth.uid()::TEXT);

-- ============================================================
-- INDEXES for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_farms_owner           ON public.farms(owner_id);
CREATE INDEX IF NOT EXISTS idx_livestock_owner_farm  ON public.livestock(owner_id, farm_id);
CREATE INDEX IF NOT EXISTS idx_indiv_lstock_owner    ON public.individual_livestock(owner_id, farm_id);
CREATE INDEX IF NOT EXISTS idx_indiv_lstock_group    ON public.individual_livestock(group_id);
CREATE INDEX IF NOT EXISTS idx_animal_health_animal  ON public.animal_health(animal_id, owner_id);
CREATE INDEX IF NOT EXISTS idx_animal_vacc_animal    ON public.animal_vaccinations(animal_id, owner_id);
CREATE INDEX IF NOT EXISTS idx_animal_breed_animal   ON public.animal_breeding(animal_id, owner_id);
CREATE INDEX IF NOT EXISTS idx_animal_prod_animal    ON public.animal_production(animal_id, owner_id);
CREATE INDEX IF NOT EXISTS idx_animal_weight_animal  ON public.animal_weight_logs(animal_id, owner_id);
CREATE INDEX IF NOT EXISTS idx_production_farm       ON public.production(owner_id, farm_id);
CREATE INDEX IF NOT EXISTS idx_inventory_farm        ON public.inventory(owner_id, farm_id);
CREATE INDEX IF NOT EXISTS idx_inventory_hist        ON public.inventory_history(inventory_id);
CREATE INDEX IF NOT EXISTS idx_transactions_farm     ON public.transactions(owner_id, farm_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_owner   ON public.activity_logs(owner_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_score     ON public.leaderboard(score DESC);

-- ============================================================
-- REALTIME — enable for live-update tables
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.farms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.livestock;
ALTER PUBLICATION supabase_realtime ADD TABLE public.individual_livestock;
ALTER PUBLICATION supabase_realtime ADD TABLE public.animal_health;
ALTER PUBLICATION supabase_realtime ADD TABLE public.animal_vaccinations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.animal_breeding;
ALTER PUBLICATION supabase_realtime ADD TABLE public.animal_production;
ALTER PUBLICATION supabase_realtime ADD TABLE public.animal_weight_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.production;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.leaderboard;

-- ============================================================
-- Done! All 16 tables created with RLS + indexes + realtime.
-- ============================================================
