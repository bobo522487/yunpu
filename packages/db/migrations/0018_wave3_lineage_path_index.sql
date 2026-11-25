-- Wave 3 follow-up: the ltree GiST index bloated to gigabytes after repeated
-- full rebuilds and made every incremental path update slow.  Path prefixes
-- are fixed-format hex labels, so a btree text_pattern_ops index serves the
-- descendant queries without GiST's update amplification.

DROP INDEX IF EXISTS public.idx_lineage_projection_path;
CREATE INDEX idx_lineage_projection_path_text
  ON public.lineage_projection (project_id, (primary_path::text) text_pattern_ops);

CREATE OR REPLACE FUNCTION app.shift_lineage_subtree(
  p_project uuid,
  p_person uuid,
  p_old_path public.ltree,
  p_old_generation integer,
  p_new_path public.ltree,
  p_new_generation integer
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_org uuid;
BEGIN
  IF p_new_path IS NOT DISTINCT FROM p_old_path
     AND p_new_generation IS NOT DISTINCT FROM p_old_generation THEN
    RETURN;
  END IF;

  IF p_old_path IS NULL THEN
    SELECT organization_id INTO v_org
      FROM public.project
     WHERE id = p_project;
    IF v_org IS NULL THEN
      RETURN;
    END IF;

    INSERT INTO public.lineage_projection AS lp
      (organization_id, project_id, person_id, primary_path, generation, updated_at)
    VALUES
      (v_org, p_project, p_person, p_new_path, p_new_generation, clock_timestamp())
    ON CONFLICT (project_id, person_id) DO UPDATE
       SET primary_path = EXCLUDED.primary_path,
           generation = EXCLUDED.generation,
           updated_at = clock_timestamp()
     WHERE lp.primary_path IS DISTINCT FROM EXCLUDED.primary_path
        OR lp.generation IS DISTINCT FROM EXCLUDED.generation;
    RETURN;
  END IF;

  UPDATE public.lineage_projection AS lp
     SET primary_path = CASE
           WHEN lp.person_id = p_person THEN p_new_path
           ELSE p_new_path || subpath(
             lp.primary_path,
             nlevel(p_old_path),
             nlevel(lp.primary_path) - nlevel(p_old_path)
           )
         END,
         generation = CASE
           WHEN lp.person_id = p_person THEN p_new_generation
           ELSE lp.generation + (p_new_generation - p_old_generation)
         END,
         updated_at = clock_timestamp()
   WHERE lp.project_id = p_project
     AND (
       lp.primary_path::text = p_old_path::text
       OR lp.primary_path::text LIKE p_old_path::text || '.%'
     )
     AND (
       lp.primary_path IS DISTINCT FROM CASE
         WHEN lp.person_id = p_person THEN p_new_path
         ELSE p_new_path || subpath(
           lp.primary_path,
           nlevel(p_old_path),
           nlevel(lp.primary_path) - nlevel(p_old_path)
         )
       END
       OR lp.generation IS DISTINCT FROM CASE
         WHEN lp.person_id = p_person THEN p_new_generation
         ELSE lp.generation + (p_new_generation - p_old_generation)
       END
     );
END;
$$;
