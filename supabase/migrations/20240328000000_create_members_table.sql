-- members: unified leaderboard source for both authenticated and imported/ghost members
CREATE TABLE IF NOT EXISTS public.members (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name      text        NOT NULL,
  last_name       text        NOT NULL,
  college         text,
  year            text,
  points          integer     NOT NULL DEFAULT 0,
  events_attended integer     NOT NULL DEFAULT 0,
  user_id         uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Tracks which event points have already been assigned per member (prevents double-import)
CREATE TABLE IF NOT EXISTS public.member_event_attendance (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id    uuid        NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  event_id     uuid        NOT NULL REFERENCES public.events(id)  ON DELETE CASCADE,
  points_earned integer    NOT NULL DEFAULT 0,
  imported_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(member_id, event_id)
);

-- RLS
ALTER TABLE public.members               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_event_attendance ENABLE ROW LEVEL SECURITY;

-- Public read (leaderboard is public)
CREATE POLICY "Anyone can view members"
  ON public.members FOR SELECT USING (true);

-- Authenticated write (admin check enforced in-app)
CREATE POLICY "Authenticated users can insert members"
  ON public.members FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update members"
  ON public.members FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete members"
  ON public.members FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Anyone can view member attendance"
  ON public.member_event_attendance FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage member attendance"
  ON public.member_event_attendance FOR ALL USING (auth.role() = 'authenticated');
