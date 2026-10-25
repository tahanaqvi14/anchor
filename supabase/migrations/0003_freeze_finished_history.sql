-- ============================================================
--  Anchor — freeze finished history, protect the shared demo
--  Migration 0003   (run after 0001 and 0002; safe to re-run)
--
--  The demo account's password is public by design, so whatever its
--  owner may do, every visitor may do. Under 0001 that included deleting
--  the seeded history, rewriting finished sessions and their scores,
--  appending lines to old transcripts and renaming the account — all of
--  it visible to every visitor after them. These policies keep exactly
--  what the app needs (playing a negotiation through to its report) and
--  nothing more. The secret key bypasses RLS, so seeding is unaffected.
-- ============================================================

-- ---- profiles -------------------------------------------------
-- The app never writes profiles. Rows come from handle_new_user, and
-- is_demo/display_name are set by scripts/seed-demo.mts with the secret key.
drop policy if exists "profiles: insert own" on public.profiles;
drop policy if exists "profiles: update own" on public.profiles;

-- ---- sessions -------------------------------------------------
-- Created in progress, writable only while in progress, and deletable
-- only before the opening line exists (the start route removes a session
-- whose opening failed). A finished session is frozen.
drop policy if exists "sessions: create own" on public.sessions;
create policy "sessions: create own" on public.sessions
  for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'active');

drop policy if exists "sessions: update own" on public.sessions;
drop policy if exists "sessions: update own while active" on public.sessions;
create policy "sessions: update own while active" on public.sessions
  for update to authenticated
  using      (user_id = (select auth.uid()) and status = 'active')
  with check (user_id = (select auth.uid()));

drop policy if exists "sessions: delete own" on public.sessions;
drop policy if exists "sessions: delete own before it starts" on public.sessions;
create policy "sessions: delete own before it starts" on public.sessions
  for delete to authenticated
  using (user_id = (select auth.uid()) and status = 'active' and message_count = 0);

-- ---- messages -------------------------------------------------
-- Still append-only, and now only while the session is in progress.
drop policy if exists "messages: append own" on public.messages;
drop policy if exists "messages: append own while active" on public.messages;
create policy "messages: append own while active" on public.messages
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.sessions s
      where s.id = session_id and s.status = 'active'
    )
  );

-- ---- feedback_reports -----------------------------------------
-- Write-once, and only for a session that has finished.
drop policy if exists "reports: create own" on public.feedback_reports;
drop policy if exists "reports: create own for finished session" on public.feedback_reports;
create policy "reports: create own for finished session" on public.feedback_reports
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.sessions s
      where s.id = session_id and s.status <> 'active'
    )
  );

-- ---- backfill -------------------------------------------------
-- Sessions are now scored when they close rather than when their report
-- is written. Give any finished session left unscored by the old flow
-- its score, so it shows on the dashboard.
update public.sessions s
   set score = r.score
  from public.feedback_reports r
 where r.session_id = s.id
   and s.score is null;

update public.sessions
   set score = case outcome when 'user_walked' then 35 else 20 end
 where score is null
   and status <> 'active'
   and final_value is null;
