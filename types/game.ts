export type GameStatus = 'lobby' | 'playing' | 'voting' | 'ended'
export type Role = 'crewmate' | 'impostor'
export type SabotageType = 'lights_out' | 'reactor' | 'comms'
export type SabotageStatus = 'active' | 'fixed'

export interface Game {
  id: string
  code: string
  status: GameStatus
  host_id: string
  task_count: number
  created_at: string
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
  location: string
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
