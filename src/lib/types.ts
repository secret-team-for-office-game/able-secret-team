export type UserRole = "player" | "admin" | "super_admin";
export type PlayerStatus = "active" | "ghost" | "disqualified";
export type RoundStatus = "scheduled" | "voting_open" | "voting_closed" | "processed" | "published";
export type EliminationType = "top_n" | "top_percent";
export type CardCode = "revive" | "reveal" | "team_switch";
export type CardStatus = "available" | "used" | "expired";

export interface TeamDef {
  id: string;
  team_code: "dolphin" | "whale" | "shark";
  team_name: string;
  icon: string;
  theme_color: string;
}

export interface Profile {
  id: string;
  user_id: string | null;
  employee_id: string;
  full_name: string;
  nickname: string | null;
  department: string | null;
  avatar_url: string | null;
  role: UserRole;
  player_status: PlayerStatus;
  total_score: number;
}

export interface VotablePlayer {
  player_id: string;
  full_name: string;
  nickname: string | null;
  department: string | null;
  avatar_url: string | null;
}

export interface RankingRow {
  rank: number;
  full_name: string;
  nickname: string | null;
  total_score: number;
  player_status: PlayerStatus;
}

export interface GameRound {
  id: string;
  round_number: number;
  title: string | null;
  voting_start_at: string | null;
  voting_end_at: string | null;
  status: RoundStatus;
  elimination_type: EliminationType;
  elimination_value: number;
}

export interface CardType {
  id: string;
  card_code: CardCode;
  card_name: string;
  description: string | null;
  reference_price: number | null;
}

export interface PlayerCard {
  id: string;
  player_id: string;
  card_type_id: string;
  source: "starter" | "admin_grant";
  status: CardStatus;
  acquired_at: string;
  used_at: string | null;
}

export interface SystemSettings {
  event_start_at: string;
  event_end_at: string;
  result_announce_at: string;
  csr_registration_amount: number;
  vote_correct_points: number;
  vote_same_team_points: number;
  default_elimination_type: EliminationType;
  default_elimination_value: number;
}
