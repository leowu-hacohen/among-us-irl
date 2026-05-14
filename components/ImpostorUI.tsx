'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import SabotagePanel from './SabotagePanel'
import KillButton from './KillButton'
import type { Player, Task, Sabotage } from '@/types/game'
import { playEmergencyMeeting } from '@/lib/sounds'

interface Props {
  player: Player
  gameId: string
  gameCode: string
}

const FAKE_TASKS = [
  { name: 'Fix Wiring', location: 'Electrical Room', done: false },
  { name: 'Calibrate Navigation', location: 'Navigation Room', done: false },
  { name: 'Submit Scan', location: 'MedBay', done: false },
]

export default function ImpostorUI({ player, gameId, gameCode }: Props) {
  const [alivePlayers, setAlivePlayers] = useState<Player[]>([])
  const [activeSabotage, setActiveSabotage] = useState<Sabotage | null>(null)
  const [allTasks, setAllTasks] = useState<Task[]>([])
  const [killCooldown, setKillCooldown] = useState(0)
  const [callingMeeting, setCallingMeeting] = useState(false)
  const [showFakeTasks, setShowFakeTasks] = useState(false)

  // Kill cooldown timer
  useEffect(() => {
    if (killCooldown <= 0) return
    const timer = setTimeout(() => setKillCooldown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [killCooldown])

  const fetchPlayers = useCallback(async () => {
    const { data } = await supabase
      .from('players')
      .select()
      .eq('game_id', gameId)
      .eq('is_alive', true)
      .neq('id', player.id)
    if (data) setAlivePlayers(data)
  }, [gameId, player.id])

  const fetchSabotage = useCallback(async () => {
    const { data } = await supabase
      .from('sabotages')
      .select()
      .eq('game_id', gameId)
      .eq('status', 'active')
      .order('triggered_at', { ascending: false })
      .limit(1)
    setActiveSabotage(data && data.length > 0 ? data[0] : null)
  }, [gameId])

  const fetchTasks = useCallback(async () => {
    const { data } = await supabase.from('tasks').select().eq('game_id', gameId)
    if (data) setAllTasks(data)
  }, [gameId])

  useEffect(() => {
    fetchPlayers()
    fetchSabotage()
    fetchTasks()

    const channel = supabase
      .channel(`impostor-${player.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `game_id=eq.${gameId}` }, fetchPlayers)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sabotages', filter: `game_id=eq.${gameId}` }, fetchSabotage)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `game_id=eq.${gameId}` }, fetchTasks)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [player.id, gameId, fetchPlayers, fetchSabotage, fetchTasks])

  function handleKill(targetId: string) {
    setAlivePlayers(prev => prev.filter(p => p.id !== targetId))
  }

  async function callEmergencyMeeting() {
    if (callingMeeting) return
    setCallingMeeting(true)
    playEmergencyMeeting()
    await supabase.from('meetings').insert({
      game_id: gameId,
      type: 'emergency',
      called_by: player.id,
      status: 'voting',
    })
    setCallingMeeting(false)
  }

  const completedTasks = allTasks.filter(t => t.is_complete).length
  const totalTasks = allTasks.length
  const taskProgress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(to bottom, #1a0505, #0d0d1a)' }}>
      <div className="flex flex-col flex-1 px-4 py-6 gap-5 max-w-sm mx-auto w-full">

        {/* Header */}
        <div className="text-center">
          <h1
            className="text-3xl font-black uppercase tracking-widest animate-pulse"
            style={{ color: '#ef4444', textShadow: '0 0 20px rgba(239,68,68,0.8), 0 0 40px rgba(239,68,68,0.4)' }}
          >
            IMPOSTOR
          </h1>
          <p className="text-gray-500 text-sm mt-1">{player.name}</p>
          <p className="text-gray-600 text-xs mt-1">Honor system: only kill when physically near</p>
        </div>

        {/* Task progress (for awareness) */}
        <div className="rounded-xl p-3 bg-[#1a1a2e] border border-white/5">
          <div className="flex justify-between mb-1">
            <span className="text-xs text-gray-400 uppercase tracking-wider">Crew Task Progress</span>
            <span className="text-xs text-red-400 font-bold">{completedTasks}/{totalTasks}</span>
          </div>
          <div className="w-full bg-[#0d0d1a] rounded-full h-2">
            <div
              className="bg-red-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${taskProgress}%` }}
            />
          </div>
          <p className="text-xs text-gray-600 mt-1">Stop them before they finish!</p>
        </div>

        {/* Crewmates to kill */}
        <div>
          <h2 className="text-red-400 font-bold uppercase tracking-wider text-sm mb-3">
            Crewmates ({alivePlayers.length} alive)
          </h2>
          {alivePlayers.length === 0 ? (
            <div className="text-center py-6 text-gray-500 text-sm">No more crewmates alive</div>
          ) : (
            <div className="flex flex-col gap-2">
              {alivePlayers.map(crewmate => (
                <div
                  key={crewmate.id}
                  className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#1a1a2e] border border-white/5"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                    <span className="text-white font-medium">{crewmate.name}</span>
                  </div>
                  <KillButton
                    target={crewmate}
                    onKill={handleKill}
                    killCooldown={killCooldown}
                    setKillCooldown={setKillCooldown}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Kill cooldown indicator */}
        {killCooldown > 0 && (
          <div className="text-center py-2 rounded-xl bg-[#1a1a2e] border border-red-900/30">
            <span className="text-red-400 text-sm font-bold">Kill cooldown: {killCooldown}s</span>
          </div>
        )}

        {/* Sabotage Panel */}
        <div className="rounded-xl p-4 bg-[#1a1a2e] border border-red-900/20">
          <SabotagePanel
            gameId={gameId}
            playerId={player.id}
            activeSabotage={activeSabotage}
          />
        </div>

        {/* Fake Task Cover */}
        <div className="rounded-xl border border-white/5 overflow-hidden">
          <button
            onClick={() => setShowFakeTasks(!showFakeTasks)}
            className="w-full px-4 py-3 bg-[#1a1a2e] text-left flex items-center justify-between"
          >
            <span className="text-gray-300 font-medium text-sm">Cover Story (Fake Tasks)</span>
            <span className="text-gray-500 text-xs uppercase tracking-wider">{showFakeTasks ? 'Hide' : 'Show'}</span>
          </button>
          {showFakeTasks && (
            <div className="px-4 py-3 bg-[#111120] border-t border-white/5">
              <p className="text-yellow-600 text-xs mb-3 uppercase tracking-wider">For blending in only</p>
              <div className="flex flex-col gap-2">
                {FAKE_TASKS.map((task, i) => (
                  <div key={i} className="px-3 py-2 rounded-lg bg-[#1a1a2e] flex items-center justify-between">
                    <div>
                      <p className="text-white text-sm font-medium">{task.name}</p>
                      <p className="text-gray-500 text-xs">📍 {task.location}</p>
                    </div>
                    <span className="text-gray-600 text-xs">Fake</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Emergency Meeting */}
        <div className="mt-auto">
          <button
            onClick={callEmergencyMeeting}
            disabled={callingMeeting}
            className="w-full py-4 rounded-xl bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white font-black text-lg uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-red-900/50"
          >
            {callingMeeting ? 'Calling...' : '🚨 Emergency Meeting'}
          </button>
        </div>
      </div>
    </div>
  )
}
