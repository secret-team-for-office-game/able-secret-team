-- =====================================================================
-- 04_game_functions.sql — Phase 2-5 game logic
-- Run AFTER 01_schema.sql, 02_rls.sql, 03_seed.sql
-- =====================================================================

-- ---------- ROUND MANAGEMENT (admin only) ----------

create or replace function admin_open_voting(p_round_id uuid, p_duration_hours int default 24)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  update game_rounds set status = 'voting_open',
    voting_start_at = now(), voting_end_at = now() + (p_duration_hours || ' hours')::interval
  where id = p_round_id;
  insert into audit_logs(actor_id, action_type, entity_type, entity_id)
    values ((select employee_id from profiles where user_id = auth.uid()), 'open_voting', 'game_rounds', p_round_id::text);
end;
$$;
grant execute on function admin_open_voting(uuid, int) to authenticated;

create or replace function admin_close_voting(p_round_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  update game_rounds set status = 'voting_closed' where id = p_round_id;
  insert into audit_logs(actor_id, action_type, entity_type, entity_id)
    values ((select employee_id from profiles where user_id = auth.uid()), 'close_voting', 'game_rounds', p_round_id::text);
end;
$$;
grant execute on function admin_close_voting(uuid) to authenticated;

-- Preview: compute (but do not commit) score changes + eliminations for a round.
create or replace function admin_preview_round(p_round_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_round record;
  v_settings record;
  v_cut int;
  v_active_count int;
  result jsonb;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select * into v_round from game_rounds where id = p_round_id;
  select * into v_settings from system_settings where id = 1;

  select count(*) into v_active_count from profiles where role='player' and player_status='active';
  v_cut := case when v_round.elimination_type = 'top_n' then v_round.elimination_value
                else greatest(1, round(v_active_count * v_round.elimination_value / 100.0)::int) end;
  v_cut := least(v_cut, v_active_count);

  with vote_scores as (
    select v.voter_id,
           case when v.voter_team_snapshot <> v.target_team_snapshot then v_settings.vote_correct_points
                else v_settings.vote_same_team_points end as pts
    from votes v where v.round_id = p_round_id
  ),
  score_by_voter as (
    select voter_id, sum(pts) as score_change from vote_scores group by voter_id
  ),
  votes_received as (
    select target_player_id, count(*) as cnt
    from votes where round_id = p_round_id
    group by target_player_id
  ),
  ranked_targets as (
    select p.id, p.full_name, p.nickname, coalesce(vr.cnt,0) as votes_received
    from profiles p
    left join votes_received vr on vr.target_player_id = p.id
    where p.role = 'player' and p.player_status = 'active'
    order by coalesce(vr.cnt,0) desc
  ),
  to_eliminate as (
    select * from ranked_targets where votes_received > 0 limit v_cut
  )
  select jsonb_build_object(
    'roundId', p_round_id,
    'eliminationCount', v_cut,
    'scoreChanges', (select coalesce(jsonb_agg(jsonb_build_object('playerId',voter_id,'scoreChange',score_change)),'[]'::jsonb) from score_by_voter),
    'eliminated', (select coalesce(jsonb_agg(jsonb_build_object('playerId',id,'name',coalesce(nickname,full_name),'votesReceived',votes_received)),'[]'::jsonb) from to_eliminate)
  ) into result;

  return result;
end;
$$;
grant execute on function admin_preview_round(uuid) to authenticated;

-- Publish: commit the preview, update scores/status/eliminations, close round, open next.
create or replace function admin_publish_round(p_round_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_round record;
  v_settings record;
  v_cut int;
  v_active_count int;
  v_actor text;
  rec record;
  v_next_round_id uuid;
  v_next_number int;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select employee_id into v_actor from profiles where user_id = auth.uid();
  select * into v_round from game_rounds where id = p_round_id;
  if v_round.status = 'published' then raise exception 'รอบนี้ประกาศไปแล้ว'; end if;
  select * into v_settings from system_settings where id = 1;

  select count(*) into v_active_count from profiles where role='player' and player_status='active';
  v_cut := case when v_round.elimination_type = 'top_n' then v_round.elimination_value
                else greatest(1, round(v_active_count * v_round.elimination_value / 100.0)::int) end;
  v_cut := least(v_cut, v_active_count);

  -- 1) mark each vote's correctness + score awarded
  update votes set
    is_correct = (voter_team_snapshot <> target_team_snapshot),
    score_awarded = case when voter_team_snapshot <> target_team_snapshot
                         then v_settings.vote_correct_points else v_settings.vote_same_team_points end,
    processed_at = now()
  where round_id = p_round_id and processed_at is null;

  -- 2) apply score changes to profiles
  for rec in
    select voter_id, sum(score_awarded) as delta from votes where round_id = p_round_id group by voter_id
  loop
    update profiles set total_score = total_score + rec.delta where id = rec.voter_id;
  end loop;

  -- 3) determine + apply eliminations
  for rec in
    select p.id, count(v.id) as votes_received
    from profiles p
    left join votes v on v.round_id = p_round_id and v.target_player_id = p.id
    where p.role = 'player' and p.player_status = 'active'
    group by p.id
    having count(v.id) > 0
    order by count(v.id) desc
    limit v_cut
  loop
    update profiles set player_status = 'ghost' where id = rec.id;
    insert into eliminations(round_id, player_id, votes_received) values (p_round_id, rec.id, rec.votes_received);
  end loop;

  -- 4) snapshot player_round_results for every player
  insert into player_round_results (round_id, player_id, score_change, total_score_after_round, votes_received, elimination_status)
  select p.id, p_round_id,
         coalesce((select sum(score_awarded) from votes where round_id=p_round_id and voter_id=p.id), 0),
         p.total_score,
         coalesce((select count(*) from votes where round_id=p_round_id and target_player_id=p.id), 0),
         case when exists(select 1 from eliminations where round_id=p_round_id and player_id=p.id) then 'eliminated' else 'safe' end
  from profiles p where p.role = 'player'
  on conflict (round_id, player_id) do nothing;

  -- 5) close out the round
  update game_rounds set status = 'published', processed_at = now(), processed_by = v_actor, published_at = now()
  where id = p_round_id;

  -- 6) auto-create next round (scheduled) if it doesn't exist
  v_next_number := v_round.round_number + 1;
  if not exists (select 1 from game_rounds where round_number = v_next_number) then
    insert into game_rounds (round_number, title, status, elimination_type, elimination_value)
    values (v_next_number, 'สัปดาห์ที่ ' || v_next_number, 'scheduled', v_settings.default_elimination_type, v_settings.default_elimination_value)
    returning id into v_next_round_id;
  end if;

  insert into audit_logs(actor_id, action_type, entity_type, entity_id)
    values (v_actor, 'publish_round', 'game_rounds', p_round_id::text);

  return jsonb_build_object('ok', true, 'eliminatedCount', v_cut);
end;
$$;
grant execute on function admin_publish_round(uuid) to authenticated;

-- ---------- CARD USAGE (players — security definer, self-checked) ----------

create or replace function use_reveal_card(p_card_id uuid, p_target_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := my_profile_id();
  v_card record;
  v_target_team record;
begin
  select * into v_card from player_cards where id = p_card_id and player_id = v_me;
  if v_card is null then raise exception 'ไม่พบการ์ดนี้'; end if;
  if v_card.status <> 'available' then raise exception 'การ์ดนี้ถูกใช้ไปแล้ว'; end if;
  select ct.card_code into v_target_team from card_types ct where ct.id = v_card.card_type_id and ct.card_code = 'reveal';
  if v_target_team is null then raise exception 'การ์ดนี้ไม่ใช่ Reveal Card'; end if;

  select t.team_code, t.team_name, t.icon into v_target_team
  from player_team_assignments pta join teams t on t.id = pta.team_id
  where pta.player_id = p_target_id and pta.effective_to is null;

  update player_cards set status = 'used', used_at = now() where id = p_card_id;
  insert into card_usage_logs (player_card_id, player_id, target_player_id, result_data)
  values (p_card_id, v_me, p_target_id, jsonb_build_object('team_code', v_target_team.team_code));

  return jsonb_build_object('team_code', v_target_team.team_code, 'team_name', v_target_team.team_name, 'icon', v_target_team.icon);
end;
$$;
grant execute on function use_reveal_card(uuid, uuid) to authenticated;

create or replace function use_revive_card(p_card_id uuid, p_target_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := my_profile_id();
  v_card record;
  v_target_status player_status;
  v_elim_id uuid;
  v_usage_id uuid;
begin
  select * into v_card from player_cards where id = p_card_id and player_id = v_me;
  if v_card is null then raise exception 'ไม่พบการ์ดนี้'; end if;
  if v_card.status <> 'available' then raise exception 'การ์ดนี้ถูกใช้ไปแล้ว'; end if;
  if not exists (select 1 from card_types where id = v_card.card_type_id and card_code = 'revive') then
    raise exception 'การ์ดนี้ไม่ใช่ Revive Card';
  end if;

  select player_status into v_target_status from profiles where id = p_target_id;
  if v_target_status <> 'ghost' then raise exception 'ผู้เล่นคนนี้ไม่ได้อยู่ใน Ghost Mode'; end if;

  update player_cards set status = 'used', used_at = now() where id = p_card_id;
  insert into card_usage_logs (player_card_id, player_id, target_player_id, result_data)
  values (p_card_id, v_me, p_target_id, jsonb_build_object('action','revive')) returning id into v_usage_id;

  update profiles set player_status = 'active' where id = p_target_id;

  select id into v_elim_id from eliminations where player_id = p_target_id and revived_at is null
    order by eliminated_at desc limit 1;
  if v_elim_id is not null then
    update eliminations set revived_at = now(), revive_card_usage_id = v_usage_id where id = v_elim_id;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function use_revive_card(uuid, uuid) to authenticated;

create or replace function use_team_switch_card(p_card_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := my_profile_id();
  v_card record;
  v_current_team uuid;
  v_new_team uuid;
  v_new_code text;
begin
  select * into v_card from player_cards where id = p_card_id and player_id = v_me;
  if v_card is null then raise exception 'ไม่พบการ์ดนี้'; end if;
  if v_card.status <> 'available' then raise exception 'การ์ดนี้ถูกใช้ไปแล้ว'; end if;
  if not exists (select 1 from card_types where id = v_card.card_type_id and card_code = 'team_switch') then
    raise exception 'การ์ดนี้ไม่ใช่ Team Switch Card';
  end if;

  select team_id into v_current_team from player_team_assignments where player_id = v_me and effective_to is null;

  select id, team_code into v_new_team, v_new_code from teams
  where id <> v_current_team and is_active = true
  order by random() limit 1;

  update player_team_assignments set effective_to = now() where player_id = v_me and effective_to is null;
  insert into player_team_assignments (player_id, team_id, assignment_type, assigned_by)
  values (v_me, v_new_team, 'team_switch_card', 'self');

  update player_cards set status = 'used', used_at = now() where id = p_card_id;
  insert into card_usage_logs (player_card_id, player_id, result_data)
  values (p_card_id, v_me, jsonb_build_object('action','team_switch'));

  return jsonb_build_object('new_team_code', v_new_code);
end;
$$;
grant execute on function use_team_switch_card(uuid) to authenticated;

-- ---------- ADMIN: grant a card + record CSR (no slip/approval) ----------
create or replace function admin_grant_card(p_employee_id text, p_card_code text, p_qty int, p_amount int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_actor text;
  v_player_id uuid;
  v_card_type_id uuid;
  i int;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select employee_id into v_actor from profiles where user_id = auth.uid();

  select id into v_player_id from profiles where employee_id = p_employee_id and role = 'player';
  if v_player_id is null then raise exception 'ไม่พบผู้เล่นรหัสนี้'; end if;

  select id into v_card_type_id from card_types where card_code = p_card_code;
  if v_card_type_id is null then raise exception 'ไม่พบชนิดการ์ดนี้'; end if;

  for i in 1..greatest(p_qty,1) loop
    insert into player_cards (player_id, card_type_id, source, granted_by, status)
    values (v_player_id, v_card_type_id, 'admin_grant', v_actor, 'available');
  end loop;

  insert into csr_transactions (player_id, transaction_type, amount, quantity, card_type_id, recorded_by)
  values (v_player_id, 'card_purchase', p_amount, p_qty, v_card_type_id, v_actor);

  insert into audit_logs(actor_id, action_type, entity_type, entity_id, after_data)
    values (v_actor, 'grant_card', 'player_cards', v_player_id::text, jsonb_build_object('card_code',p_card_code,'qty',p_qty));

  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function admin_grant_card(text, text, int, int) to authenticated;

-- ---------- ADMIN: finalize prizes + lucky draw ----------
create or replace function admin_finalize_prizes()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_actor text;
  v_rank1 uuid; v_rank2 uuid; v_rank3 uuid; v_mvp uuid;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select employee_id into v_actor from profiles where user_id = auth.uid();

  select id into v_rank1 from profiles where role='player' order by total_score desc limit 1 offset 0;
  select id into v_rank2 from profiles where role='player' order by total_score desc limit 1 offset 1;
  select id into v_rank3 from profiles where role='player' order by total_score desc limit 1 offset 2;

  select player_id into v_mvp from (
    select player_id, sum(quantity) as qty, sum(amount) as amt, min(created_at) as first_at
    from csr_transactions where transaction_type = 'card_purchase'
    group by player_id
    order by qty desc, amt desc, first_at asc
    limit 1
  ) x;

  insert into prizes (prize_code, prize_name, winner_player_id, finalized_at, finalized_by) values
    ('rank1','อันดับ 1', v_rank1, now(), v_actor),
    ('rank2','อันดับ 2', v_rank2, now(), v_actor),
    ('rank3','อันดับ 3', v_rank3, now(), v_actor),
    ('mvp_fighter','MVP นักสู้', v_mvp, now(), v_actor)
  on conflict (prize_code) do update set winner_player_id = excluded.winner_player_id,
    finalized_at = excluded.finalized_at, finalized_by = excluded.finalized_by;

  insert into audit_logs(actor_id, action_type, entity_type) values (v_actor, 'finalize_prizes', 'prizes');
  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function admin_finalize_prizes() to authenticated;

create or replace function admin_lucky_draw(p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_actor text;
  v_winner uuid;
  v_winner_name text;
  v_eligible jsonb;
  v_seq int;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select employee_id into v_actor from profiles where user_id = auth.uid();

  select coalesce(jsonb_agg(id), '[]'::jsonb) into v_eligible
  from profiles where role = 'player' and player_status <> 'disqualified';

  select id, coalesce(nickname, full_name) into v_winner, v_winner_name
  from profiles where role = 'player' and player_status <> 'disqualified'
  order by random() limit 1;

  select coalesce(max(draw_sequence),0) + 1 into v_seq from lucky_draw_logs;

  insert into lucky_draw_logs (eligible_players_snapshot, winner_player_id, draw_sequence, reason, drawn_by)
  values (v_eligible, v_winner, v_seq, p_reason, v_actor);

  insert into prizes (prize_code, prize_name, winner_player_id, finalized_at, finalized_by)
  values ('lucky_draw', 'Lucky Draw', v_winner, now(), v_actor)
  on conflict (prize_code) do update set winner_player_id = excluded.winner_player_id,
    finalized_at = excluded.finalized_at, finalized_by = excluded.finalized_by;

  insert into audit_logs(actor_id, action_type, entity_type, after_data)
    values (v_actor, case when p_reason is null then 'lucky_draw' else 'lucky_redraw' end, 'lucky_draw_logs',
            jsonb_build_object('winner', v_winner_name, 'reason', p_reason));

  return jsonb_build_object('winnerId', v_winner, 'winnerName', v_winner_name);
end;
$$;
grant execute on function admin_lucky_draw(text) to authenticated;
