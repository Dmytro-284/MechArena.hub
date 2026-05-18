-- Run this in Supabase → SQL Editor
-- (only if you already ran supabase-setup.sql before)

CREATE TABLE IF NOT EXISTS promo_meta (
  id         BOOLEAN PRIMARY KEY DEFAULT true CHECK (id = true),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO promo_meta DEFAULT VALUES ON CONFLICT DO NOTHING;

ALTER TABLE promo_meta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_meta" ON promo_meta FOR SELECT USING (true);
