ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS org_type text;

COMMENT ON COLUMN public.profiles.org_type IS 'Central Govt / State Govt / PSU / Private / Other';