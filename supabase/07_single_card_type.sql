-- =====================================================================
-- 07_single_card_type.sql
-- Restricts the special-card system to Revive only, per updated decision.
-- Reveal and Team Switch are soft-disabled (kept in the table for
-- historical/audit purposes — any already-granted cards of those types
-- still exist and remain usable) but Admin can no longer grant new ones,
-- and this is enforced server-side, not just hidden in the UI.
-- =====================================================================

update card_types set is_active = false where card_code in ('reveal', 'team_switch');

create or replace function admin_grant_card(p_employee_id text, p_card_code text, p_qty int, p_amount int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_actor text;
  v_player_id uuid;
  v_card_type_id uuid;
  i int;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  if p_card_code <> 'revive' then
    raise exception 'ตอนนี้ระบบมีการ์ดพิเศษแบบเดียวคือ Revive Card เท่านั้น';
  end if;

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
