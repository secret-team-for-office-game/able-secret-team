-- =====================================================================
-- 06_admin_revive.sql
-- Removes the player-facing card system's revive path in favor of a
-- dedicated Admin-only revive action with a count + audit trail.
-- The card tables/functions from 04_game_functions.sql are left in place
-- (harmless, unused) rather than dropped, to avoid a destructive migration
-- on a live database. Only this new path is wired into the app.
-- =====================================================================

alter table profiles add column if not exists revive_count int not null default 0;

create table if not exists revive_logs (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references profiles(id) on delete cascade,
  admin_employee_id text not null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists idx_revive_logs_player on revive_logs(player_id);

alter table revive_logs enable row level security;

drop policy if exists revive_logs_self_read on revive_logs;
create policy revive_logs_self_read on revive_logs for select
  using (player_id = my_profile_id() or is_admin());

drop policy if exists revive_logs_admin on revive_logs;
create policy revive_logs_admin on revive_logs for all
  using (is_admin()) with check (is_admin());

-- Admin-only revive: sets the player back to 'active', increments their
-- revive_count, links the most recent un-revived elimination (if any),
-- and records who did it and when.
create or replace function admin_revive_player(p_employee_id text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_actor text;
  v_player_id uuid;
  v_status player_status;
  v_elim_id uuid;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select employee_id into v_actor from profiles where user_id = auth.uid();

  select id, player_status into v_player_id, v_status
  from profiles where employee_id = p_employee_id and role = 'player';

  if v_player_id is null then raise exception 'ไม่พบผู้เล่นรหัสนี้'; end if;
  if v_status <> 'ghost' then raise exception 'ผู้เล่นคนนี้ไม่ได้อยู่ในสถานะเสียชีวิต'; end if;

  update profiles set player_status = 'active', revive_count = revive_count + 1
  where id = v_player_id;

  insert into revive_logs (player_id, admin_employee_id, note)
  values (v_player_id, v_actor, p_note);

  select id into v_elim_id from eliminations
  where player_id = v_player_id and revived_at is null
  order by eliminated_at desc limit 1;
  if v_elim_id is not null then
    update eliminations set revived_at = now() where id = v_elim_id;
  end if;

  insert into audit_logs(actor_id, action_type, entity_type, entity_id, after_data)
  values (v_actor, 'admin_revive', 'profiles', v_player_id::text, jsonb_build_object('employee_id', p_employee_id, 'note', p_note));

  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function admin_revive_player(text, text) to authenticated;
