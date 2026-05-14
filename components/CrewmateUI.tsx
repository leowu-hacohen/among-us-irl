'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import TaskList from './TaskList'
import SabotageAlert from './SabotageAlert'
import type { Player, Task, Sabotage } from '@/types/game'

interface Props {
  player: Player
  gameId: string
  gameCode: string
}

export default function CrewmateUI({ player, gameId, gameCode }: Props) {
  const [myTasks, setMyTasks] = useState<Task[]>([])
  const [allTasks, setAllTasks] = useState<Task[]>([])
  const [activeSabotage, setActiveSabotage] = useState<Sabotage | null>(null)
  const [allPlayers, setAllPlayers] = useState<Player[]>([])
  const [showReport, setShowReport] = useState(false)
  const [callingMeeting, setCallingMeeting] = useState(false)

  const fetchTasks = useCallback(async () => {
    const { data: mine } = await supabase.from('tasks').select().eq('player_id', player.id)
    const { data: all } = await supabase.from('tasks').select().eq('game_id', gameId)
    if (mine) setMyTasks(mine)
    if (all) setAllTasks(all)
  }, [player.id, gameId])

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

  const fetchPlayers = useCallback(async () => {
    const { data } = await supabase.from('players').select().eq('game_id', gameId)
    if (data) setAllPlayers(data)
  }, [gameId])

  useEffect(() => {
    fetchTasks()
    fetchSabotage()
    fetchPlayers()

    const channel = supabase
      .channel(`crewmate-${player.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `game_id=eq.${gameId}` }, fetchTasks)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sabotages', filter: `game_id=eq.${gameId}` }, fetchSabotage)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `game_id=eq.${gameId}` }, fetchPlayers)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [player.id, gameId, fetchTasks, fetchSabotage, fetchPlayers])

  function handleTaskComplete(taskId: string) {
    setMyTasks(prev => prev.map(t => t.id === taskId ? { ...t, is_complete: true } : t))
    setAllTasks(prev => prev.map(t => t.id === taskId ? { ...t, is_complete: true } : t))
  }

  async function callEmergencyMeeting() {
    if (callingMeeting) return
    setCallingMeeting(true)
    await supabase.from('meetings').insert({
      game_id: gameId,
      type: 'emergency',
      called_by: player.id,
      status: 'voting',
    })
    setCallingMeeting(false)
  }

  async function reportBody(deadPlayerId: string) {
    if (callingMeeting) return
    setCallingMeeting(true)
    setShowReport(false)
    await supabase.from('meetings').insert({
      game_id: gameId,
      type: 'report',
      called_by: player.id,
      reported_body: deadPlayerId,
      status: 'voting',
    })
    setCallingMeeting(false)
  }

  const isDead = !player.is_alive
  const deadPlayers = allPlayers.filter(p => !p.is_alive && p.id !== player.id)
  const alivePlayers = allPlayers.filter(p => p.is_alive)

  // Lights out: dim screen
  const isLightsOut = activeSabotage?.type === 'lights_out'

  return (
    <div className={`min-h-screen flex flex-col ${isDead ? 'opacity-70' : ''}`}
      style={{ background: isLightsOut && !isDead ? '#050508' : '#0d0d1a' }}>

      {/* Sabotage alert overlay */}
      {activeSabotage && !isDead && (
        <SabotageAlert
          sabotage={activeSabotage}
          playerId={player.id}
          onFixed={() => setActiveSabotage(null)}
        />
      )}

      {/* Dead overlay */}
      {isDead && (
        <div className="fixed inset-0 z-40 pointer-events-none"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'grayscale(100%)' }}>
          <div className="absolute top-20 left-0 right-0 text-center">
            <p className="text-6xl font-black text-gray-400 opacity-30 uppercase tracking-widest">GHOST</p>
          </div>
        </div>
      )}

      <div className="relative z-10 flex flex-col flex-1 px-4 py-6 gap-6 max-w-sm mx-auto w-full">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isDead ? 'bg-gray-500' : 'bg-green-400'} animate-pulse`} />
            <h1
              className={`text-2xl font-black uppercase tracking-widest ${isDead ? 'text-gray-500' : 'text-green-400'}`}
              style={!isDead ? { textShadow: '0 0 15px rgba(74,222,128,0.6)' } : undefined}
            >
              {isDead ? 'GHOST' : 'CREWMATE'}
            </h1>
          </div>
          <p className="text-gray-500 text-sm mt-1">{player.name}</p>
          {isDead && (
            <p className="text-gray-400 mt-2 text-sm">You are dead. Complete tasks to help your team.</p>
          )}
        </div>

        {/* Lights out message */}
        {isLightsOut && !isDead && (
          <div className="rounded-xl p-4 bg-yellow-900/30 border border-yellow-600/50 text-center">
            <p className="text-yellow-300 font-bold uppercase tracking-wider">⚡ Lights Out</p>
            <p className="text-yellow-200 text-sm mt-1">Find the fix station!</p>
          </div>
        )}

        {/* Alive players count */}
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">{alivePlayers.length} alive</span>
          <span className="text-gray-600">Game: {gameCode}</span>
        </div>

        {/* Tasks */}
        {!isLightsOut && (
          <TaskList
            tasks={myTasks}
            allTasks={allTasks}
            onTaskComplete={handleTaskComplete}
            isDead={isDead}
          />
        )}

        {/* Report Body Modal */}
        {showReport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6 bg-black/70">
            <div className="bg-[#1a1a2e] rounded-2xl p-6 w-full max-w-sm border border-white/10">
              <h3 className="text-white font-bold text-lg mb-4 text-center uppercase">Report Body</h3>
              {deadPlayers.length === 0 ? (
                <p className="text-gray-400 text-center text-sm mb-4">No dead players found nearby</p>
              ) : (
                <div className="flex flex-col gap-2 mb-4">
                  {deadPlayers.map(p => (
                    <button
                      key={p.id}
                      onClick={() => reportBody(p.id)}
                      className="w-full py-3 rounded-xl bg-orange-700/50 hover:bg-orange-600/50 border border-orange-600/30 text-white font-bold uppercase tracking-wider transition-all active:scale-95"
                    >
                      {p.name}&apos;s body
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={() => setShowReport(false)}
                className="w-full py-2 text-gray-400 hover:text-white text-sm uppercase"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Bottom action buttons */}
        <div className="mt-auto flex flex-col gap-3">
          <button
            onClick={() => setShowReport(true)}
            disabled={isDead}
            className="w-full py-3 rounded-xl bg-orange-700/70 hover:bg-orange-600/70 disabled:opacity-30 border border-orange-600/30 text-white font-bold uppercase tracking-wider transition-all active:scale-95"
          >
            🔴 Report Body
          </button>
          <button
            onClick={callEmergencyMeeting}
            disabled={isDead || callingMeeting}
            className="w-full py-4 rounded-xl bg-red-700 hover:bg-red-600 disabled:opacity-30 text-white font-black text-lg uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-red-900/50"
          >
            {callingMeeting ? 'Calling...' : '🚨 Emergency Meeting'}
          </button>
        </div>
      </div>
    </div>
  )
}
