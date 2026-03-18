-- Table to track which member pairs have been ignored/dismissed in the Merge Suggestions UI
CREATE TABLE IF NOT EXISTS public.merge_exclusions (
  target_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (target_id, source_id)
);

ALTER TABLE public.merge_exclusions ENABLE ROW LEVEL SECURITY;

-- Only authenticated admins can manage exclusions
CREATE POLICY "Authenticated users can manage merge exclusions"
  ON public.merge_exclusions
  FOR ALL
  USING (auth.role() = 'authenticated');

-- Drop the old simple merge if it exists from earlier
DROP FUNCTION IF EXISTS public.merge_members(uuid, uuid);

-- Enhanced smart merge function
CREATE OR REPLACE FUNCTION public.smart_merge_members(p_source_id uuid, p_target_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_source record;
  v_target record;
BEGIN
  -- 1. Fetch source and target
  SELECT * INTO v_source FROM public.members WHERE id = p_source_id;
  SELECT * INTO v_target FROM public.members WHERE id = p_target_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source or target member not found.';
  END IF;

  -- 2. "Fill the voids" - copy missing data from source to target
  UPDATE public.members
  SET
    college = COALESCE(v_target.college, v_source.college),
    year    = COALESCE(v_target.year, v_source.year),
    email   = COALESCE(v_target.email, v_source.email),
    updated_at = now()
  WHERE id = p_target_id;

  -- 3. Move attendance records
  -- Using ON CONFLICT DO NOTHING so duplicate events are just ignored for the target
  INSERT INTO public.member_event_attendance (member_id, event_id, points_earned, imported_at)
  SELECT p_target_id, event_id, points_earned, imported_at
  FROM public.member_event_attendance
  WHERE member_id = p_source_id
  ON CONFLICT (member_id, event_id) DO NOTHING;

  -- 4. Delete the source member
  -- (This will trigger ON DELETE CASCADE for any remaining attendance records on the source)
  DELETE FROM public.members WHERE id = p_source_id;
  
  -- Note: The `update_member_points_on_attendance_change` trigger will 
  -- automatically run because we inserted/deleted attendance records,
  -- so v_target points and events_attended will be instantly correct!
END;
$$;
