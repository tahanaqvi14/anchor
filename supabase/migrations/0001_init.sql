-- ============================================================
--  Anchor — initial schema
--  Migration 0001
--
--  Design notes worth knowing before you read:
--   * Personas are NOT a table. Persona system prompts are application
--     logic and belong in git (typed, diffable, reviewable). Sessions
--     record persona_key + persona_version so any past session stays
--     reproducible against the prompt that actually produced it.
--   * messages/feedback_reports carry a denormalized user_id so their
--     RLS predicate is a bare indexed equality instead of a subquery
--     into sessions on every row. A COMPOSITE foreign key back to
--     sessions(id, user_id) makes a mismatched user_id physically
--     impossible to insert, so the denormalization cannot drift.
--   * Every policy uses (select auth.uid()) rather than auth.uid().
--     Postgres hoists the former into an InitPlan evaluated once per
--     statement; the bare call is re-evaluated per row.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
--  profiles
-- ------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url   text,
  is_demo      boolean     not null default false,
  created_at   timestamptz not null default now()
);

comment on column public.profiles.is_demo is
  'Marks the shared read-only demo account so seeded history can be reset.';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name',
             split_part(coalesce(new.email, 'there'), '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$fn$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
--  scenarios   (global presets + user-authored custom)
-- ------------------------------------------------------------
create table public.scenarios (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete cascade,
  is_preset      boolean     not null default false,
  slug           text,
  title          text        not null,
  summary        text        not null,
  user_role      text        not null,   -- who the human plays
  ai_role        text        not null,   -- who the model plays
  unit           text        not null default 'USD',
  unit_suffix    text,                   -- '/yr', '/hr', '/mo' — display only
  context_fields jsonb       not null default '[]'::jsonb,
  created_at     timestamptz not null default now(),

  -- a row is either a global preset (no owner) or an owned custom scenario
  constraint scenarios_ownership_ck check (
       (is_preset     and user_id is null and slug is not null)
    or (not is_preset and user_id is not null)
  )
);

comment on column public.scenarios.context_fields is
  'Declarative form spec: [{key,label,type,required,placeholder,help}]. Adding a scenario is a data change, not a code change.';

create unique index scenarios_slug_uk  on public.scenarios (slug) where is_preset;
create index        scenarios_user_idx on public.scenarios (user_id) where user_id is not null;

-- ------------------------------------------------------------
--  sessions
-- ------------------------------------------------------------
create table public.sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id)       on delete cascade,
  scenario_id     uuid not null references public.scenarios(id) on delete restrict,

  persona_key     text not null check (persona_key in
                     ('lowballer','staller','professional','closer')),
  persona_version int  not null default 1,

  status          text not null default 'active'
                     check (status in ('active','completed','abandoned')),
  outcome         text check (outcome in
                     ('deal','no_deal','user_walked','ai_walked')),

  context         jsonb   not null default '{}'::jsonb,  -- answers to context_fields

  -- lifted out of context jsonb because the dashboard charts on them
  target_value    numeric,
  opening_anchor  numeric,   -- the AI's first number, for anchor-shift analysis
  final_value     numeric,   -- null when no deal was struck
  score           int check (score between 0 and 100),

  message_count   int not null default 0,
  started_at      timestamptz not null default now(),
  ended_at        timestamptz,

  -- an active session has no verdict; a finished one must have both
  constraint sessions_terminal_ck check (
       (status =  'active' and outcome is null     and ended_at is null)
    or (status <> 'active' and outcome is not null and ended_at is not null)
  ),

  -- redundant as a key, REQUIRED as the target of the composite FKs below
  constraint sessions_id_user_uk unique (id, user_id)
);

create index sessions_user_recent_idx on public.sessions (user_id, started_at desc);
create index sessions_user_status_idx on public.sessions (user_id, status);

-- ------------------------------------------------------------
--  messages   (append-only transcript)
-- ------------------------------------------------------------
create table public.messages (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id    uuid not null,
  seq        int  not null check (seq > 0),   -- 1-based; the report cites "message 4"
  role       text not null check (role in ('user','ai')),
  content    text not null check (char_length(content) between 1 and 4000),
  input_mode text not null default 'text' check (input_mode in ('text','voice')),
  created_at timestamptz not null default now(),

  constraint messages_session_fk foreign key (session_id, user_id)
    references public.sessions (id, user_id) on delete cascade,
  constraint messages_seq_uk unique (session_id, seq)
);

create index messages_session_seq_idx on public.messages (session_id, seq);
create index messages_user_idx        on public.messages (user_id);

create or replace function public.bump_message_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  update public.sessions
     set message_count = message_count + 1
   where id = new.session_id;
  return new;
end;
$fn$;

create trigger messages_bump_count
  after insert on public.messages
  for each row execute function public.bump_message_count();

-- ------------------------------------------------------------
--  feedback_reports   (write-once, one per session)
-- ------------------------------------------------------------
create table public.feedback_reports (
  id                    uuid primary key default gen_random_uuid(),
  session_id            uuid not null unique,
  user_id               uuid not null,

  score                 int  not null check (score between 0 and 100),
  headline              text not null,
  outcome_summary       text not null,

  -- structured, not a markdown blob: each item pins to a transcript seq so
  -- the UI can render a citation that scrolls to the exact message.
  --   [{ title, detail, message_seq, quote }]
  strengths             jsonb not null default '[]'::jsonb,
  missteps              jsonb not null default '[]'::jsonb,
  --   [{ message_seq, you_said, try_instead, why }]
  alternative_phrasings jsonb not null default '[]'::jsonb,

  target_delta          numeric,   -- final_value - target_value
  model                 text not null,
  raw                   jsonb,     -- full model response, for debugging
  created_at            timestamptz not null default now(),

  constraint reports_session_fk foreign key (session_id, user_id)
    references public.sessions (id, user_id) on delete cascade
);

create index reports_user_recent_idx on public.feedback_reports (user_id, created_at desc);

-- ============================================================
--  Row Level Security
--  Every table denies by default; nothing relies on app-level filtering.
-- ============================================================

alter table public.profiles         enable row level security;
alter table public.scenarios        enable row level security;
alter table public.sessions         enable row level security;
alter table public.messages         enable row level security;
alter table public.feedback_reports enable row level security;

-- ---- profiles -------------------------------------------------
create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));

create policy "profiles: insert own" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));

create policy "profiles: update own" on public.profiles
  for update to authenticated
  using       (id = (select auth.uid()))
  with check  (id = (select auth.uid()));
-- no delete policy: profiles die with auth.users via cascade

-- ---- scenarios ------------------------------------------------
create policy "scenarios: read presets and own" on public.scenarios
  for select to authenticated
  using (is_preset or user_id = (select auth.uid()));

create policy "scenarios: create own custom" on public.scenarios
  for insert to authenticated
  with check (user_id = (select auth.uid()) and not is_preset);

create policy "scenarios: update own custom" on public.scenarios
  for update to authenticated
  using      (user_id = (select auth.uid()) and not is_preset)
  with check (user_id = (select auth.uid()) and not is_preset);

create policy "scenarios: delete own custom" on public.scenarios
  for delete to authenticated
  using (user_id = (select auth.uid()) and not is_preset);
-- presets are seeded by migration (service role) and are unwritable by users

-- ---- sessions -------------------------------------------------
create policy "sessions: read own" on public.sessions
  for select to authenticated using (user_id = (select auth.uid()));

create policy "sessions: create own" on public.sessions
  for insert to authenticated with check (user_id = (select auth.uid()));

create policy "sessions: update own" on public.sessions
  for update to authenticated
  using      (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "sessions: delete own" on public.sessions
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---- messages -------------------------------------------------
create policy "messages: read own" on public.messages
  for select to authenticated using (user_id = (select auth.uid()));

create policy "messages: append own" on public.messages
  for insert to authenticated with check (user_id = (select auth.uid()));
-- deliberately NO update/delete policy. A transcript you can edit after the
-- fact makes the feedback report meaningless, so the DB refuses to allow it.

-- ---- feedback_reports -----------------------------------------
create policy "reports: read own" on public.feedback_reports
  for select to authenticated using (user_id = (select auth.uid()));

create policy "reports: create own" on public.feedback_reports
  for insert to authenticated with check (user_id = (select auth.uid()));
-- write-once: no update/delete policy. Reports are generated through the
-- user's own session cookie, so RLS applies to the server route too — the
-- service-role key is never used on a request path.
