-- =====================================================================
-- 05_fix_ghost_players.sql
-- Fixes the Revive-card target list, which was incorrectly built from
-- ranking_board() (a name-only public leaderboard function with no real
-- player IDs). This adds a proper function that returns real player_id
-- values for players currently in Ghost Mode, safe to call from the client.
-- =====================================================================

create or replace function ghost_players()
returns table (player_id uuid, full_name text, nickname text, department text, avatar_url text)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.nickname, p.department, p.avatar_url
  from profiles p
  where p.player_status = 'ghost'
    and p.role = 'player';
$$;
grant execute on function ghost_players() to authenticated;
