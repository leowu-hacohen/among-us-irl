import type { Game } from '@/types/game'

export interface GameConfig {
  minPlayers: number
  discussionSeconds: number
  reactorDurationSeconds: number
  reactorCooldownMs: number
  defaultTaskCount: number
  gameCodeLength: number
  reactorEnabled: boolean
  crewmateTaskWinThreshold: number
}

const BASE_CONFIG: GameConfig = {
  minPlayers: 3,
  discussionSeconds: 120,
  reactorDurationSeconds: 45,
  reactorCooldownMs: 2 * 60 * 1000,
  defaultTaskCount: 3,
  gameCodeLength: 4,
  reactorEnabled: false,
  crewmateTaskWinThreshold: 0.5,
}

const TEST_OVERRIDES: Partial<GameConfig> = {
  minPlayers: 1,
}

export function getConfig(game?: Game | null): GameConfig {
  if (game?.is_test) return { ...BASE_CONFIG, ...TEST_OVERRIDES }
  return BASE_CONFIG
}

// Scales impostor count to player count while guaranteeing >= 2 crewmates.
// `override` lets test mode pick any value in [0, playerCount] without changing the assignment code.
export function impostorCount(playerCount: number, override?: number): number {
  if (override != null) return Math.max(0, Math.min(override, playerCount))
  const base = playerCount >= 11 ? 3 : playerCount >= 5 ? 2 : 1
  return Math.max(0, Math.min(base, playerCount - 2))
}
