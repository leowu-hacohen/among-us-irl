export type GameStatus = 'lobby' | 'playing' | 'voting' | 'ended'
export type Role = 'crewmate' | 'impostor' | 'reactor_1' | 'reactor_2'
export type SabotageType = 'lights_out' | 'reactor' | 'comms'
export type SabotageStatus = 'active' | 'fixed'

export interface Game {
  id: string
  code: string
  status: GameStatus
  host_id: string
  task_count: number
  created_at: string
  current_sabotage: 'none' | 'reactor'
  reactor_code_a: string | null
  reactor_code_b: string | null
  reactor_station_a_complete: boolean
  reactor_station_b_complete: boolean
  reactor_started_at: string | null
  game_over: boolean
  winning_team: 'crewmates' | 'impostors' | null
}

export interface Player {
  id: string
  game_id: string
  name: string
  role: Role | null
  is_alive: boolean
  color: string
  created_at: string
}

export interface Task {
  id: string
  game_id: string
  player_id: string
  name: string
  emoji: string
  description: string
  is_complete: boolean
}

export interface Sabotage {
  id: string
  game_id: string
  type: SabotageType
  status: SabotageStatus
  triggered_by: string
  triggered_at: string
}

export interface Meeting {
  id: string
  game_id: string
  type: 'emergency' | 'report'
  called_by: string
  reported_body: string | null
  status: 'voting' | 'ended'
  created_at: string
}

export interface Vote {
  id: string
  meeting_id: string
  voter_id: string
  target_id: string | null
}
