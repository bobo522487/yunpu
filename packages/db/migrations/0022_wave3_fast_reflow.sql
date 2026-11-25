-- Reapply the fast single-parent reflow for databases that already ran 0017.
CREATE OR REPLACE FUNCTION app.reflow_lineage_from(p_project uuid, p_child uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_parent uuid;
  v_path public.ltree;
  v_generation integer;
  v_old_path public.ltree;
  v_old_generation integer;
BEGIN
  v_parent := app.lineage_primary_parent(p_project, p_child);

  IF v_parent IS NULL THEN
    SELECT lp.primary_path, lp.generation
      INTO v_old_path, v_old_generation
      FROM public.lineage_projection lp
     WHERE lp.project_id = p_project
       AND lp.person_id = p_child;

    PERFORM app.shift_lineage_subtree(
      p_project,
      p_child,
      v_old_path,
      v_old_generation,
      app.lineage_label(p_child),
      0
    );
    RETURN;
  END IF;

  SELECT lp.primary_path, lp.generation
    INTO v_path, v_generation
    FROM public.lineage_projection lp
   WHERE lp.project_id = p_project
     AND lp.person_id = v_parent;

  IF NOT FOUND THEN
    PERFORM app.rebuild_project_lineage(p_project);
    RETURN;
  END IF;

  SELECT lp.primary_path, lp.generation
    INTO v_old_path, v_old_generation
    FROM public.lineage_projection lp
   WHERE lp.project_id = p_project
     AND lp.person_id = p_child;

  PERFORM app.shift_lineage_subtree(
    p_project,
    p_child,
    v_old_path,
    v_old_generation,
    v_path || app.lineage_label(p_child),
    v_generation + 1
  );
END;
$$;
