-- Add soft-delete flag to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Index for the common "active users only" filter
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON profiles (is_active)
  WHERE is_active = true;
