-- Run this in Supabase → SQL Editor

CREATE TABLE IF NOT EXISTS promo_codes (
  id      UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  code    TEXT    NOT NULL,
  reward  TEXT    NOT NULL DEFAULT '',
  active  BOOLEAN NOT NULL DEFAULT true,
  is_new  BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS is_new BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read" ON promo_codes FOR SELECT USING (true);

-- Singleton row that stores when admin last made any change
CREATE TABLE IF NOT EXISTS promo_meta (
  id         BOOLEAN PRIMARY KEY DEFAULT true CHECK (id = true),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO promo_meta DEFAULT VALUES ON CONFLICT DO NOTHING;

ALTER TABLE promo_meta ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_meta" ON promo_meta FOR SELECT USING (true);

-- Admin writes use the service_role key which bypasses RLS.
