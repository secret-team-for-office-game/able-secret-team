-- =====================================================================
-- THE ABLE SECRET TEAM — Database Schema (PostgreSQL / Supabase)
-- Run in Supabase SQL Editor, in order: 01_schema.sql → 02_rls.sql → 03_seed.sql
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- ENUMs ----------
do $$ begin create type user_role as enum ('player','admin','super_admin'); exception when duplicate_object then null; end $$;
do $$ begin create type player_status as enum ('active','ghost','disqualified'); exception when duplicate_object then null; end $$;
do $$ begin create type assignment_type as enum ('initial','team_switch_card','admin_override'); exception when duplicate_object then null; end $$;
do $$ begin create type round_status as enum ('scheduled','voting_open','voting_closed','processed','published'); exception when duplicate_object then null; end $$;
do $$ begin create type elimination_type as enum ('top_n','top_percent'); exception when duplicate_object then null; end $$;
do $$ begin create type card_source as enum ('starter','admin_grant'); exception when duplicate_object then null; end $$;
do $$ begin create type card_status as enum ('available','used','expired'); exception when duplicate_object then null; end $$;
do $$ begin create type csr_txn_type as enum ('registration','card_purchase'); exception when duplicate_object then null; end $$;

-- ---------- profiles ----------
-- No email column: players log in with employee_id + password only.
-- A synthetic email (employee_id@AUTH_EMAIL_DOMAIN) is used purely as
-- plumbing for Supabase Auth and is never shown to anyone.
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  employee_id text not null unique,
  full_name text not null,
  nickname text,
  department text,
  avatar_url text,
  role user_role not null default 'player',
  player_status player_status not null default 'active',
  total_score int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_profiles_employee on profiles(employee_id);
create index if not exists idx_profiles_status on profiles(player_status);

-- ---------- teams ----------
create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  team_code text not null unique,       -- 'dolphin' | 'whale' | 'shark'
  team_name text not null,
  icon text not null,
  theme_color text not null,
  is_active boolean not null default true
);

-- ---------- player_team_assignments ----------
-- Current assignment = row where effective_to is null.
create table if not exists player_team_assignments (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references profiles(id) on delete cascade,
  team_id uuid not null references teams(id),
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  assignment_type assignment_type not null default 'initial',
  assigned_by text,                     -- 'system' or admin employee_id
  created_at timestamptz not null default now()
);
create index if not exists idx_pta_player on player_team_assignments(player_id);
create unique index if not exists idx_pta_current on player_team_assignments(player_id) where effective_to is null;

-- ---------- game_rounds ----------
create table if not exists game_rounds (
  id uuid primary key default gen_random_uuid(),
  round_number int not null unique,
  title text,
  voting_start_at timestamptz,
  voting_end_at timestamptz,
  result_at timestamptz,
  status round_status not null default 'scheduled',
  elimination_type elimination_type not null default 'top_n',
  elimination_value int not null default 1,
  processed_at timestamptz,
  processed_by text,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- votes ----------
-- RLS on this table is admin-only (see 02_rls.sql). Players never read
-- is_correct/score_awarded/team snapshots directly, even their own — they
-- only learn whether they've submitted via the my_vote_status() function.
create table if not exists votes (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references game_rounds(id) on delete cascade,
  voter_id uuid not null references profiles(id) on delete cascade,
  target_player_id uuid not null references profiles(id),
  voter_team_snapshot uuid,             -- team_id at time of vote (frozen)
  target_team_snapshot uuid,
  is_correct boolean,
  score_awarded int,
  submitted_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (round_id, voter_id),
  check (voter_id <> target_player_id)
);
create index if not exists idx_votes_round on votes(round_id);

-- ---------- player_round_results ----------
create table if not exists player_round_results (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references game_rounds(id) on delete cascade,
  player_id uuid not null references profiles(id) on delete cascade,
  score_change int not null default 0,
  total_score_after_round int not null default 0,
  votes_received int not null default 0,
  rank_after_round int,
  elimination_status text,              -- 'safe' | 'eliminated' | 'revived'
  created_at timestamptz not null default now(),
  unique (round_id, player_id)
);

-- ---------- card_types ----------
create table if not exists card_types (
  id uuid primary key default gen_random_uuid(),
  card_code text not null unique,       -- 'revive' | 'reveal' | 'team_switch'
  card_name text not null,
  description text,
  reference_price int,                  -- informational only; no in-app payment
  is_active boolean not null default true
);

-- ---------- player_cards ----------
create table if not exists player_cards (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references profiles(id) on delete cascade,
  card_type_id uuid not null references card_types(id),
  source card_source not null default 'starter',
  granted_by text,                      -- admin employee_id, or 'system' for the free starter card
  status card_status not null default 'available',
  acquired_at timestamptz not null default now(),
  used_at timestamptz,
  expires_at timestamptz
);
create index if not exists idx_pc_player on player_cards(player_id);

-- ---------- card_usage_logs ----------
create table if not exists card_usage_logs (
  id uuid primary key default gen_random_uuid(),
  player_card_id uuid not null references player_cards(id) on delete cascade,
  player_id uuid not null references profiles(id) on delete cascade,
  target_player_id uuid references profiles(id),
  round_id uuid references game_rounds(id),
  result_data jsonb,                    -- e.g. {"revealed_team_code": "shark"} — only readable by the user who used the card
  used_at timestamptz not null default now()
);

-- ---------- csr_transactions ----------
-- Simplified per decision: no slip upload, no approval workflow.
-- Admin manually records what was collected outside the app.
create table if not exists csr_transactions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references profiles(id) on delete cascade,
  transaction_type csr_txn_type not null,
  amount int not null default 0,
  quantity int not null default 1,
  card_type_id uuid references card_types(id),
  recorded_by text not null,            -- admin employee_id
  note text,
  created_at timestamptz not null default now()
);
create index if not exists idx_csr_player on csr_transactions(player_id);

-- ---------- eliminations ----------
create table if not exists eliminations (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references game_rounds(id) on delete cascade,
  player_id uuid not null references profiles(id) on delete cascade,
  votes_received int not null default 0,
  eliminated_at timestamptz not null default now(),
  revived_at timestamptz,
  revive_card_usage_id uuid references card_usage_logs(id)
);

-- ---------- prizes ----------
create table if not exists prizes (
  id uuid primary key default gen_random_uuid(),
  prize_code text not null unique,      -- 'rank1' | 'rank2' | 'rank3' | 'mvp_fighter' | 'lucky_draw'
  prize_name text not null,
  winner_player_id uuid references profiles(id),
  finalized_at timestamptz,
  finalized_by text
);

-- ---------- lucky_draw_logs ----------
create table if not exists lucky_draw_logs (
  id uuid primary key default gen_random_uuid(),
  eligible_players_snapshot jsonb not null,
  winner_player_id uuid references profiles(id),
  draw_sequence int not null default 1,
  reason text,                          -- populated on re-draw
  drawn_by text not null,
  drawn_at timestamptz not null default now()
);

-- ---------- system_settings ----------
create table if not exists system_settings (
  id int primary key default 1,
  setting_key text,                     -- kept for compatibility; primary storage is the jsonb columns below
  setting_value jsonb,
  event_start_at timestamptz not null default '2026-08-04 00:00:00+07',
  event_end_at timestamptz not null default '2026-09-04 00:00:00+07',
  result_announce_at timestamptz not null default '2026-09-08 00:00:00+07',
  csr_registration_amount int not null default 75,
  vote_correct_points int not null default 10,
  vote_same_team_points int not null default -5,
  default_elimination_type elimination_type not null default 'top_n',
  default_elimination_value int not null default 3,
  updated_by text,
  updated_at timestamptz not null default now(),
  constraint singleton check (id = 1)
);

-- ---------- audit_logs ----------
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id text not null,               -- admin employee_id or 'system'
  action_type text not null,
  entity_type text,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_created on audit_logs(created_at desc);

-- ---------- helper: role checks ----------
create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where user_id = auth.uid() and role in ('admin','super_admin')
  );
$$;

create or replace function is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles where user_id = auth.uid() and role = 'super_admin'
  );
$$;

create or replace function my_profile_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from profiles where user_id = auth.uid();
$$;

create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_profiles_touch on profiles;
create trigger trg_profiles_touch before update on profiles
  for each row execute function touch_updated_at();
