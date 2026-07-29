-- =====================================================================
-- Row Level Security + secure functions — run AFTER 01_schema.sql
-- =====================================================================

alter table profiles                  enable row level security;
alter table teams                     enable row level security;
alter table player_team_assignments   enable row level security;
alter table game_rounds               enable row level security;
alter table votes                     enable row level security;
alter table player_round_results      enable row level security;
alter table card_types                enable row level security;
alter table player_cards              enable row level security;
alter table card_usage_logs           enable row level security;
alter table csr_transactions          enable row level security;
alter table eliminations              enable row level security;
alter table prizes                    enable row level security;
alter table lucky_draw_logs           enable row level security;
alter table system_settings           enable row level security;
alter table audit_logs                enable row level security;

-- ---------- profiles: own row only (direct table access) ----------
-- Other players' public info is served through votable_players()/ranking_board()
-- below, never through a broad table policy — this is what keeps employee_id
-- and any other sensitive column from leaking.
drop policy if exists profiles_self on profiles;
create policy profiles_self on profiles for select
  using (user_id = auth.uid() or is_admin());

drop policy if exists profiles_self_update on profiles;
create policy profiles_self_update on profiles for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists profiles_admin_all on profiles;
create policy profiles_admin_all on profiles for all
  using (is_admin()) with check (is_admin());

-- ---------- teams: admin only via table; players never need raw access ----------
drop policy if exists teams_admin on teams;
create policy teams_admin on teams for all using (is_admin()) with check (is_admin());

-- ---------- player_team_assignments: admin only via table ----------
-- Players get their OWN team exclusively through my_team() below (security
-- definer, bypasses RLS, checks auth.uid() internally). No player policy
-- exists here at all — that is intentional.
drop policy if exists pta_admin on player_team_assignments;
create policy pta_admin on player_team_assignments for all
  using (is_admin()) with check (is_admin());

-- ---------- game_rounds: readable by everyone (needed for countdowns/status) ----------
drop policy if exists rounds_read on game_rounds;
create policy rounds_read on game_rounds for select using (true);
drop policy if exists rounds_admin on game_rounds;
create policy rounds_admin on game_rounds for all using (is_admin()) with check (is_admin());

-- ---------- votes: admin-only table access. Players use cast_vote()/my_vote_status() ----------
drop policy if exists votes_admin on votes;
create policy votes_admin on votes for all using (is_admin()) with check (is_admin());

-- ---------- player_round_results: own rows + admin ----------
drop policy if exists prr_self on player_round_results;
create policy prr_self on player_round_results for select
  using (player_id = my_profile_id() or is_admin());
drop policy if exists prr_admin on player_round_results;
create policy prr_admin on player_round_results for all using (is_admin()) with check (is_admin());

-- ---------- card_types: public read, admin write ----------
drop policy if exists ct_read on card_types;
create policy ct_read on card_types for select using (true);
drop policy if exists ct_admin on card_types;
create policy ct_admin on card_types for all using (is_admin()) with check (is_admin());

-- ---------- player_cards: own rows + admin ----------
drop policy if exists pc_self on player_cards;
create policy pc_self on player_cards for select
  using (player_id = my_profile_id() or is_admin());
drop policy if exists pc_admin on player_cards;
create policy pc_admin on player_cards for all using (is_admin()) with check (is_admin());

-- ---------- card_usage_logs: only the USER who used the card (never the target) ----------
drop policy if exists cul_self on card_usage_logs;
create policy cul_self on card_usage_logs for select
  using (player_id = my_profile_id() or is_admin());
drop policy if exists cul_admin on card_usage_logs;
create policy cul_admin on card_usage_logs for all using (is_admin()) with check (is_admin());

-- ---------- csr_transactions: own rows + admin; only admin inserts ----------
drop policy if exists csr_self on csr_transactions;
create policy csr_self on csr_transactions for select
  using (player_id = my_profile_id() or is_admin());
drop policy if exists csr_admin on csr_transactions;
create policy csr_admin on csr_transactions for all using (is_admin()) with check (is_admin());

-- ---------- eliminations: admin only via table; public info goes through published_eliminations() ----------
drop policy if exists elim_admin on eliminations;
create policy elim_admin on eliminations for all using (is_admin()) with check (is_admin());

-- ---------- prizes: public can read only finalized prizes ----------
drop policy if exists prizes_read on prizes;
create policy prizes_read on prizes for select using (finalized_at is not null or is_admin());
drop policy if exists prizes_admin on prizes;
create policy prizes_admin on prizes for all using (is_admin()) with check (is_admin());

-- ---------- lucky_draw_logs: admin only ----------
drop policy if exists ldl_admin on lucky_draw_logs;
create policy ldl_admin on lucky_draw_logs for all using (is_admin()) with check (is_admin());

-- ---------- system_settings: public read (dates/scoring rules), admin write ----------
drop policy if exists settings_read on system_settings;
create policy settings_read on system_settings for select using (true);
drop policy if exists settings_admin on system_settings;
create policy settings_admin on system_settings for all using (is_admin()) with check (is_admin());

-- ---------- audit_logs: admin only ----------
drop policy if exists audit_admin on audit_logs;
create policy audit_admin on audit_logs for all using (is_admin()) with check (is_admin());

-- =====================================================================
-- SECURE FUNCTIONS — the only way players interact with team-sensitive data
-- =====================================================================

-- Caller's own current team. Never accepts a player_id argument — always
-- resolves from auth.uid() server-side, so it is architecturally impossible
-- to call this for someone else's team.
create or replace function my_team()
returns table (team_id uuid, team_code text, team_name text, icon text, theme_color text)
language sql stable security definer set search_path = public as $$
  select t.id, t.team_code, t.team_name, t.icon, t.theme_color
  from player_team_assignments pta
  join teams t on t.id = pta.team_id
  where pta.player_id = my_profile_id() and pta.effective_to is null;
$$;
grant execute on function my_team() to authenticated;

-- List of players who can currently be voted for (excludes self, excludes
-- non-active players). Deliberately omits any team column.
create or replace function votable_players()
returns table (player_id uuid, full_name text, nickname text, department text, avatar_url text)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.nickname, p.department, p.avatar_url
  from profiles p
  where p.player_status = 'active'
    and p.id <> my_profile_id()
    and p.role = 'player';
$$;
grant execute on function votable_players() to authenticated;

-- Public ranking board — score + rank + status only, never team.
create or replace function ranking_board()
returns table (rank bigint, full_name text, nickname text, total_score int, player_status player_status)
language sql stable security definer set search_path = public as $$
  select row_number() over (order by total_score desc) as rank,
         full_name, nickname, total_score, player_status
  from profiles
  where role = 'player'
  order by total_score desc
  limit 500;
$$;
grant execute on function ranking_board() to authenticated;

-- Has the caller already voted this round? No target/correctness leaked.
create or replace function my_vote_status(p_round_id uuid)
returns table (has_voted boolean, submitted_at timestamptz)
language sql stable security definer set search_path = public as $$
  select true, v.submitted_at
  from votes v
  where v.round_id = p_round_id and v.voter_id = my_profile_id()
  union all
  select false, null::timestamptz
  where not exists (
    select 1 from votes v2 where v2.round_id = p_round_id and v2.voter_id = my_profile_id()
  )
  limit 1;
$$;
grant execute on function my_vote_status(uuid) to authenticated;

-- Cast a vote. All authorization + business rules enforced here, server-side.
-- Returns true on success; raises a friendly exception on any violation.
create or replace function cast_vote(p_round_id uuid, p_target_player_id uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_voter_id uuid;
  v_round record;
  v_voter_status player_status;
  v_target_status player_status;
  v_voter_team uuid;
  v_target_team uuid;
begin
  v_voter_id := my_profile_id();
  if v_voter_id is null then
    raise exception 'ไม่พบบัญชีผู้เล่น';
  end if;
  if v_voter_id = p_target_player_id then
    raise exception 'โหวตตัวเองไม่ได้';
  end if;

  select * into v_round from game_rounds where id = p_round_id;
  if v_round is null or v_round.status <> 'voting_open' then
    raise exception 'รอบนี้ไม่ได้เปิดรับโหวตอยู่';
  end if;
  if now() < v_round.voting_start_at or now() > v_round.voting_end_at then
    raise exception 'อยู่นอกช่วงเวลาโหวต';
  end if;

  select player_status into v_voter_status from profiles where id = v_voter_id;
  if v_voter_status <> 'active' then
    raise exception 'คุณไม่สามารถโหวตได้ในสถานะปัจจุบัน';
  end if;

  select player_status into v_target_status from profiles where id = p_target_player_id;
  if v_target_status is null or v_target_status <> 'active' then
    raise exception 'ผู้เล่นคนนี้ไม่สามารถเป็นเป้าหมายโหวตได้';
  end if;

  if exists (select 1 from votes where round_id = p_round_id and voter_id = v_voter_id) then
    raise exception 'คุณโหวตในรอบนี้ไปแล้ว';
  end if;

  select team_id into v_voter_team from player_team_assignments
    where player_id = v_voter_id and effective_to is null;
  select team_id into v_target_team from player_team_assignments
    where player_id = p_target_player_id and effective_to is null;

  insert into votes (round_id, voter_id, target_player_id, voter_team_snapshot, target_team_snapshot)
  values (p_round_id, v_voter_id, p_target_player_id, v_voter_team, v_target_team);

  return true;
end;
$$;
grant execute on function cast_vote(uuid, uuid) to authenticated;

-- Public per-round summary for the Weekly Result screen: counts + eliminated
-- names only, once the round is published. No individual score deltas, no
-- vote counts, no team info.
create or replace function round_summary(p_round_id uuid)
returns table (
  active_count bigint,
  ghost_count bigint,
  eliminated_names text[]
)
language sql stable security definer set search_path = public as $$
  select
    (select count(*) from profiles where role = 'player' and player_status = 'active'),
    (select count(*) from profiles where role = 'player' and player_status = 'ghost'),
    (select coalesce(array_agg(coalesce(p.nickname, p.full_name)), '{}')
       from eliminations e join profiles p on p.id = e.player_id
       where e.round_id = p_round_id
         and exists (select 1 from game_rounds gr where gr.id = p_round_id and gr.status = 'published'));
$$;
grant execute on function round_summary(uuid) to authenticated;
