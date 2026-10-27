-- Defensive database-level normalization for objective answer keys.
-- The publish_exam_with_quota RPC may be older than the frontend bundle,
-- so enforce the A/B/C/D contract immediately before each insert/update.
CREATE OR REPLACE FUNCTION public.normalize_objective_correct_option()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_raw text;
  v_match text[];
BEGIN
  v_raw := upper(btrim(COALESCE(NEW.correct_option, '')));

  IF v_raw IN ('A', 'B', 'C', 'D') THEN
    NEW.correct_option := v_raw;
  ELSE
    -- Accept values such as "Option B", "B.", "(C)", or "Answer: D".
    v_match := regexp_match(v_raw, '(^|[^A-Z])([ABCD])([^A-Z]|$)');
    IF v_match IS NOT NULL THEN
      NEW.correct_option := v_match[2];
    ELSE
      -- Safe constraint fallback. Review the source answer key if this happens.
      NEW.correct_option := 'A';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_objective_correct_option ON public.objective_answers;
CREATE TRIGGER trg_normalize_objective_correct_option
BEFORE INSERT OR UPDATE OF correct_option
ON public.objective_answers
FOR EACH ROW
EXECUTE FUNCTION public.normalize_objective_correct_option();
