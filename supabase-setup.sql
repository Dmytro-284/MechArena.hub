-- Run this in Supabase → SQL Editor

CREATE TABLE IF NOT EXISTS promo_codes (
  id      UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  code    TEXT    NOT NULL,
  reward  TEXT    NOT NULL DEFAULT '',
  active  BOOLEAN NOT NULL DEFAULT true
);

-- Public can read all rows (filtering to active is done in the API)
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read" ON promo_codes
  FOR SELECT USING (true);

-- Admin writes use the service_role key which bypasses RLS.
