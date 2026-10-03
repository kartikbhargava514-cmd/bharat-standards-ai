CREATE SEQUENCE IF NOT EXISTS public.procurement_ref_seq START 1;
GRANT USAGE ON SEQUENCE public.procurement_ref_seq TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.next_procurement_ref() RETURNS text LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  SELECT 'BSA-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.procurement_ref_seq')::text, 5, '0')
$$;
GRANT EXECUTE ON FUNCTION public.next_procurement_ref() TO authenticated, service_role;
ALTER TABLE public.procurements ADD COLUMN IF NOT EXISTS ref_no text;
UPDATE public.procurements p SET ref_no = 'BSA-' || to_char(p.created_at, 'YYYY') || '-' || lpad(nextval('public.procurement_ref_seq')::text, 5, '0')
  FROM (SELECT id FROM public.procurements WHERE ref_no IS NULL ORDER BY created_at) o WHERE p.id = o.id;
ALTER TABLE public.procurements ALTER COLUMN ref_no SET DEFAULT public.next_procurement_ref();
ALTER TABLE public.procurements ALTER COLUMN ref_no SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS procurements_ref_no_key ON public.procurements(ref_no);