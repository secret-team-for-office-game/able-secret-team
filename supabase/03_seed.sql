-- =====================================================================
-- Seed data — run AFTER 01_schema.sql and 02_rls.sql
-- =====================================================================

-- teams
insert into teams (team_code, team_name, icon, theme_color, is_active) values
  ('dolphin', 'ทีมโลมา', '🐬', '#3d9fd6', true),
  ('whale',   'ทีมวาฬ',  '🐳', '#8a5cf0', true),
  ('shark',   'ทีมฉลาม', '🦈', '#e0533f', true)
on conflict (team_code) do nothing;

-- card types (reference_price is informational only — no in-app payment)
insert into card_types (card_code, card_name, description, reference_price, is_active) values
  ('revive', 'Revive Card — ชุบชีวิต',
    'ช่วยผู้เล่นที่ถูกคัดออกในรอบนั้นกลับเข้าสู่เกม คะแนนสะสมเดิมยังอยู่ ต้องใช้ก่อนสิ้นสุดวันศุกร์', 100, true),
  ('reveal', 'Reveal Card — ส่อง',
    'ส่องดูทีมของผู้เล่น 1 คน เห็นเฉพาะผู้ใช้การ์ด ผู้ถูกส่องไม่ทราบว่าใครเป็นผู้ส่อง', 80, true),
  ('team_switch', 'Team Switch Card — ย้ายทีม',
    'สุ่มย้ายผู้ใช้ไปยัง 1 ใน 2 ทีมที่เหลือ (ห้ามอยู่ทีมเดิม) เป็นความลับ คะแนนสะสมเดิมยังอยู่', 80, true)
on conflict (card_code) do nothing;

-- system settings (single row) — event window per spec, editable from Admin
insert into system_settings (id, event_start_at, event_end_at, result_announce_at,
  csr_registration_amount, vote_correct_points, vote_same_team_points,
  default_elimination_type, default_elimination_value)
values (1, '2026-08-04 00:00:00+07', '2026-09-04 00:00:00+07', '2026-09-08 00:00:00+07',
  75, 10, -5, 'top_n', 3)
on conflict (id) do nothing;

-- round 1 (scheduled, not yet open)
insert into game_rounds (round_number, title, status, elimination_type, elimination_value)
values (1, 'สัปดาห์ที่ 1', 'scheduled', 'top_n', 3)
on conflict (round_number) do nothing;
