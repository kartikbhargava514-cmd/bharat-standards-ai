-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  email text,
  full_name text,
  department text,
  designation text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- STANDARDS (public reference data)
CREATE TABLE public.standards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_number text NOT NULL UNIQUE,
  title text NOT NULL,
  scope text NOT NULL,
  category text NOT NULL,
  standard_type text NOT NULL DEFAULT 'Core Standard',
  year int,
  status text NOT NULL DEFAULT 'Current',
  latest_amendment text,
  certification text,
  key_parameters text[] NOT NULL DEFAULT '{}',
  applicable_for text,
  keywords text[] NOT NULL DEFAULT '{}',
  related_standards text[] NOT NULL DEFAULT '{}',
  source_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.standards TO anon;
GRANT SELECT ON public.standards TO authenticated;
GRANT ALL ON public.standards TO service_role;
ALTER TABLE public.standards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "standards public read" ON public.standards FOR SELECT TO anon, authenticated USING (true);

-- PROCUREMENTS
CREATE TABLE public.procurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  quantity text,
  unit text,
  application text,
  category text,
  language text DEFAULT 'en',
  structured_requirements jsonb,
  summary text,
  alerts jsonb,
  status text NOT NULL DEFAULT 'In Progress',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.procurements TO authenticated;
GRANT ALL ON public.procurements TO service_role;
ALTER TABLE public.procurements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own procurements" ON public.procurements FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- RECOMMENDATIONS
CREATE TABLE public.recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  procurement_id uuid NOT NULL REFERENCES public.procurements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  standard_id uuid REFERENCES public.standards(id) ON DELETE SET NULL,
  is_number text NOT NULL,
  title text,
  category text NOT NULL DEFAULT 'Core Standard',
  relevance int NOT NULL DEFAULT 0,
  reason text,
  evidence text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recommendations TO authenticated;
GRANT ALL ON public.recommendations TO service_role;
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own recommendations" ON public.recommendations FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_recos_proc ON public.recommendations(procurement_id);
CREATE INDEX idx_proc_user ON public.procurements(user_id, created_at DESC);