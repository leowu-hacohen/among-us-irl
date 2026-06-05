import { supabase } from './supabase'
import { getConfig } from './gameConfig'

export async function completeTask(taskId: string) {
  await supabase.from('tasks').update({ is_complete: true }).eq('id', taskId)
}

// Kills a player and checks impostor/crew parity. Used by self-kill UI and DevPanel.
// Mirrors the original inline check in app/game/[code]/page.tsx markSelfKilled.
export async function killPlayer(gameId: string, playerId: string) {
  await supabase.from('players').update({ is_alive: false }).eq('id', playerId)
  const { data: alive } = await supabase
    .from('players').select('role').eq('game_id', gameId).eq('is_alive', true)
  if (!alive) return
  const aliveImpostors = alive.filter(p => p.role === 'impostor').length
  const aliveCrewmates = alive.filter(p => p.role === 'crewmate').length
  if (aliveImpostors >= aliveCrewmates && aliveImpostors > 0) {
    await supabase.from('games')
      .update({ game_over: true, winning_team: 'impostors' })
      .eq('id', gameId).eq('game_over', false)
  }
}

export interface CallMeetingOpts {
  gameId: string
  callerId: string
  type: 'emergency' | 'report'
  reportedBody?: string | null
}

export async function callMeeting(opts: CallMeetingOpts) {
  await supabase.from('meetings').insert({
    game_id: opts.gameId,
    type: opts.type,
    called_by: opts.callerId,
    reported_body: opts.reportedBody ?? null,
    status: 'voting',
  })
  const { data } = await supabase.from('meetings').select('id')
    .eq('game_id', opts.gameId).order('created_at', { ascending: false }).limit(1).single()
  return data?.id as string | undefined
}

function random4() {
  return String(Math.floor(Math.random() * 10000)).padStart(4, '0')
}

// Starts a reactor sabotage. No-ops if one is already active or cooldown hasn't elapsed.
export async function triggerReactor(gameId: string) {
  const { data: g } = await supabase.from('games')
    .select('current_sabotage, reactor_cooldown_until').eq('id', gameId).single()
  if (!g) return
  if (g.current_sabotage === 'reactor') return
  if (g.reactor_cooldown_until && new Date(g.reactor_cooldown_until) > new Date()) return
  await supabase.from('games').update({
    current_sabotage: 'reactor',
    reactor_code_a: random4(),
    reactor_code_b: random4(),
    reactor_started_at: new Date().toISOString(),
    reactor_station_a_complete: false,
    reactor_station_b_complete: false,
  }).eq('id', gameId).eq('current_sabotage', 'none')
}

// Successful resolution: clears state, applies cooldown.
export async function clearReactor(gameId: string) {
  const cooldownMs = getConfig().reactorCooldownMs
  await supabase.from('games').update({
    current_sabotage: 'none',
    reactor_station_a_complete: false,
    reactor_station_b_complete: false,
    reactor_started_at: null,
    reactor_code_a: null,
    reactor_code_b: null,
    reactor_cooldown_until: new Date(Date.now() + cooldownMs).toISOString(),
  }).eq('id', gameId).eq('current_sabotage', 'reactor')
}

// Marks one station complete; if both are done, clears reactor + sets cooldown.
export async function completeReactorStation(gameId: string, slot: 'A' | 'B') {
  const field = slot === 'A' ? 'reactor_station_a_complete' : 'reactor_station_b_complete'
  await supabase.from('games').update({ [field]: true }).eq('id', gameId)
  const { data: fresh } = await supabase.from('games').select().eq('id', gameId).single()
  if (fresh?.reactor_station_a_complete && fresh?.reactor_station_b_complete) {
    await clearReactor(gameId)
  }
}

// Timer-expired path: impostors win. Conditional on game_over=false so concurrent callers are idempotent.
export async function failReactor(gameId: string) {
  await supabase.from('games')
    .update({ game_over: true, winning_team: 'impostors', current_sabotage: 'none' })
    .eq('id', gameId).eq('game_over', false)
}
