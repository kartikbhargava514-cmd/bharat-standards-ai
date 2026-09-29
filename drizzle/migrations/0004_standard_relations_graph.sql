CREATE TABLE public.standard_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.standards(id) ON DELETE CASCADE,
  target_is_number text NOT NULL,
  target_id uuid REFERENCES public.standards(id) ON DELETE SET NULL,
  relation_type text NOT NULL CHECK (relation_type IN ('normative_reference','informative_reference','test_method','safety_reference','terminology','installation_reference','component_reference','related_product','supersedes','replaced_by')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, target_is_number, relation_type)
);
CREATE INDEX standard_relations_source_idx ON public.standard_relations(source_id);
CREATE INDEX standard_relations_target_idx ON public.standard_relations(target_id);
GRANT SELECT ON public.standard_relations TO anon, authenticated;
GRANT ALL ON public.standard_relations TO service_role;
ALTER TABLE public.standard_relations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "relations public read" ON public.standard_relations FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.standard_relations (source_id, target_is_number, target_id, relation_type)
SELECT s.id, r.num, t.id,
  CASE t.standard_type
    WHEN 'Testing Standard' THEN 'test_method'
    WHEN 'Safety Standard' THEN 'safety_reference'
    WHEN 'Terminology Standard' THEN 'terminology'
    WHEN 'Installation Standard' THEN 'installation_reference'
    WHEN 'Normative Reference' THEN 'normative_reference'
    WHEN 'Core Standard' THEN 'related_product'
    ELSE 'informative_reference' END
FROM public.standards s
CROSS JOIN LATERAL unnest(s.related_standards) AS r(num)
LEFT JOIN public.standards t ON t.is_number = r.num
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.standard_graph(_root_ids uuid[], _max_depth int DEFAULT 3)
RETURNS TABLE (root_id uuid, depth int, parent_id uuid, relation_type text, target_is_number text, target_id uuid, target_title text, target_status text, path uuid[])
LANGUAGE sql STABLE SET search_path = public AS $$
  WITH RECURSIVE g AS (
    SELECT r.source_id AS root_id, 1 AS depth, r.source_id AS parent_id, r.relation_type, r.target_is_number, r.target_id,
           ARRAY[r.source_id, COALESCE(r.target_id, r.source_id)] AS path
    FROM standard_relations r WHERE r.source_id = ANY(_root_ids)
    UNION ALL
    SELECT g.root_id, g.depth + 1, r.source_id, r.relation_type, r.target_is_number, r.target_id, g.path || r.target_id
    FROM g JOIN standard_relations r ON r.source_id = g.target_id
    WHERE g.depth < _max_depth AND r.target_id IS NOT NULL AND NOT (r.target_id = ANY(g.path))
  )
  SELECT g.root_id, g.depth, g.parent_id, g.relation_type, g.target_is_number, g.target_id, s.title, s.status, g.path
  FROM g LEFT JOIN standards s ON s.id = g.target_id
  ORDER BY g.root_id, g.depth;
$$;
GRANT EXECUTE ON FUNCTION public.standard_graph(uuid[], int) TO anon, authenticated;