-- =====================================================================
-- 08_wrong_vote_target_penalty.sql
-- New rule: a player who is targeted by a same-team ("wrong") vote loses
-- points too, not just the voter. This is a FLAT penalty capped once per
-- round no matter how many teammates wrongly vote for the same target.
-- Run AFTER 01-07.
-- =====================================================================

alter table system_settings
  add column if not exists target_wrong_vote_penalty int not null default -5;

update system_settings set target_wrong_vote_penalty = -5 where id = 1;

-- ---------- Preview: now also folds in the target-side penalty ----------
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
    select voter_id as player_id, sum(pts) as score_change from vote_scores group by voter_id
  ),
  wrong_targets as (
    -- distinct players wrongly targeted by a same-team vote this round —
    -- distinct so the flat penalty is capped once, however many teammates did it
    select distinct target_player_id as player_id, v_settings.target_wrong_vote_penalty as score_change
    from votes
    where round_id = p_round_id and voter_team_snapshot = target_team_snapshot
  ),
  combined as (
    select player_id, sum(score_change) as score_change
    from (select * from score_by_voter union all select * from wrong_targets) u
    group by player_id
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
  cutoff as (
    select min(votes_received) as v from (select * from ranked_targets where votes_received > 0 limit v_cut) x
  ),
  to_eliminate as (
    select rt.* from ranked_targets rt, cutoff c where rt.votes_received > 0 and rt.votes_received >= c.v
  )
  select jsonb_build_object(
    'roundId', p_round_id,
    'eliminationCount', v_cut,
    'scoreChanges', (select coalesce(jsonb_agg(jsonb_build_object('playerId',player_id,'scoreChange',score_change)),'[]'::jsonb) from combined),
    'wrongTargetPenaltyCount', (select count(*) from wrong_targets),
    'eliminated', (select coalesce(jsonb_agg(jsonb_build_object('playerId',id,'name',coalesce(nickname,full_name),'votesReceived',votes_received)),'[]'::jsonb) from to_eliminate)
  ) into result;

  return result;
end;
$$;
grant execute on function admin_preview_round(uuid) to authenticated;

-- ---------- Publish: commits both the voter-side and target-side scoring ----------
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
  v_cutoff_votes int;
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

  -- 1) mark each vote's correctness + score awarded (voter-side, unchanged)
  update votes set
    is_correct = (voter_team_snapshot <> target_team_snapshot),
    score_awarded = case when voter_team_snapshot <> target_team_snapshot
                         then v_settings.vote_correct_points else v_settings.vote_same_team_points end,
    processed_at = now()
  where round_id = p_round_id and processed_at is null;

  -- 2) apply voter-side score changes
  for rec in
    select voter_id, sum(score_awarded) as delta from votes where round_id = p_round_id group by voter_id
  loop
    update profiles set total_score = total_score + rec.delta where id = rec.voter_id;
  end loop;

  -- 3) NEW: apply the flat target-side penalty — once per distinct player
  --    wrongly targeted this round, no matter how many teammates did it.
  for rec in
    select distinct target_player_id as pid from votes
    where round_id = p_round_id and voter_team_snapshot = target_team_snapshot
  loop
    update profiles set total_score = total_score + v_settings.target_wrong_vote_penalty where id = rec.pid;
  end loop;

  -- 4) determine elimination cutoff — ALL players tied at the cutoff vote
  --    count are eliminated (per confirmed tie-break rule: no randomness).
  select min(votes_received) into v_cutoff_votes from (
    select p.id, count(v.id) as votes_received
    from profiles p
    left join votes v on v.round_id = p_round_id and v.target_player_id = p.id
    where p.role = 'player' and p.player_status = 'active'
    group by p.id
    having count(v.id) > 0
    order by count(v.id) desc
    limit v_cut
  ) x;

  if v_cutoff_votes is not null then
    for rec in
      select p.id, count(v.id) as votes_received
      from profiles p
      left join votes v on v.round_id = p_round_id and v.target_player_id = p.id
      where p.role = 'player' and p.player_status = 'active'
      group by p.id
      having count(v.id) >= v_cutoff_votes and count(v.id) > 0
    loop
      update profiles set player_status = 'ghost' where id = rec.id;
      insert into eliminations(round_id, player_id, votes_received) values (p_round_id, rec.id, rec.votes_received);
    end loop;
  end if;

  -- 5) snapshot player_round_results (voter-side + target-penalty combined)
  insert into player_round_results (round_id, player_id, score_change, total_score_after_round, votes_received, elimination_status)
  select p_round_id, p.id,
         coalesce((select sum(score_awarded) from votes where round_id=p_round_id and voter_id=p.id), 0)
         + case when exists(
             select 1 from votes where round_id=p_round_id and target_player_id=p.id and voter_team_snapshot=target_team_snapshot
           ) then v_settings.target_wrong_vote_penalty else 0 end,
         p.total_score,
         coalesce((select count(*) from votes where round_id=p_round_id and target_player_id=p.id), 0),
         case when exists(select 1 from eliminations where round_id=p_round_id and player_id=p.id) then 'eliminated' else 'safe' end
  from profiles p where p.role = 'player'
  on conflict (round_id, player_id) do nothing;

  -- 6) close out the round
  update game_rounds set status = 'published', processed_at = now(), processed_by = v_actor, published_at = now()
  where id = p_round_id;

  -- 7) auto-create next round (scheduled) if it doesn't exist
  v_next_number := v_round.round_number + 1;
  if not exists (select 1 from game_rounds where round_number = v_next_number) then
    insert into game_rounds (round_number, title, status, elimination_type, elimination_value)
    values (v_next_number, 'สัปดาห์ที่ ' || v_next_number, 'scheduled', v_settings.default_elimination_type, v_settings.default_elimination_value)
    returning id into v_next_round_id;
  end if;

  insert into audit_logs(actor_id, action_type, entity_type, entity_id)
    values (v_actor, 'publish_round', 'game_rounds', p_round_id::text);

  return jsonb_build_object('ok', true, 'eliminatedCutoffVotes', v_cutoff_votes);
end;
$$;
grant execute on function admin_publish_round(uuid) to authenticated;
