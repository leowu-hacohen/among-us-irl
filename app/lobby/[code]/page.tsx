'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { TASK_POOL } from '@/lib/tasks'
import type { Game, Player } from '@/types/game'


export default function LobbyPage() {
  const router = useRouter()
  const params = useParams()
  const code = (params.code as string).toUpperCase()

  const [game, setGame] = useState<Game | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const [reactorPickerOpen, setReactorPickerOpen] = useState(false)
  const [settingReactor, setSettingReactor] = useState(false)

  const isHost = game?.host_id === myPlayerId
  const me = players.find(p => p.id === myPlayerId)
  const isReactor = me?.role === 'reactor_1' || me?.role === 'reactor_2'
  const takenReactors = new Set(players.map(p => p.role).filter(r => r === 'reactor_1' || r === 'reactor_2'))

  const fetchGame = useCallback(async () => {
    const { data } = await supabase.from('games').select().eq('code', code).single()
    if (data) setGame(data)
    return data
  }, [code])

  const fetchPlayers = useCallback(async (gameId: string) => {
    const { data } = await supabase.from('players').select().eq('game_id', gameId).order('created_at')
    if (data) setPlayers(data)
  }, [])

  useEffect(() => {
    const pid = localStorage.getItem('playerId')
    setMyPlayerId(pid)

    let channel: ReturnType<typeof supabase.channel> | null = null

    async function init() {
      const gameData = await fetchGame()
      if (!gameData) { setError('Game not found'); setLoading(false); return }

      // If game already started, redirect
      if (gameData.status === 'playing') {
        router.push(`/game/${code}`)
        return
      }

      await fetchPlayers(gameData.id)
      setLoading(false)

      // Subscribe to player changes
      channel = supabase
        .channel(`lobby-${gameData.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `game_id=eq.${gameData.id}` }, () => {
          fetchPlayers(gameData.id)
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameData.id}` }, (payload) => {
          const updatedGame = payload.new as Game
          setGame(updatedGame)
          if (updatedGame.status === 'playing') {
            router.push(`/game/${code}`)
          }
        })
        .subscribe()
    }

    init()

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [code, router, fetchGame, fetchPlayers])

  async function selectReactor(slot: 'reactor_1' | 'reactor_2') {
    if (!myPlayerId || settingReactor) return
    setSettingReactor(true)
    await supabase.from('players').update({ role: slot }).eq('id', myPlayerId)
    setReactorPickerOpen(false)
    setSettingReactor(false)
  }

  async function startGame() {
    if (!game || players.length < 3) return
    setStarting(true)

    // Assign roles: 2 random impostors, rest crewmates — skip reactors
    const nonReactors = players.filter(p => p.role !== 'reactor_1' && p.role !== 'reactor_2')
    const shuffled = [...nonReactors].sort(() => Math.random() - 0.5)
    const impostorIds = new Set(shuffled.slice(0, 2).map(p => p.id))
    await Promise.all(nonReactors.map(p =>
      supabase.from('players').update({ role: impostorIds.has(p.id) ? 'impostor' : 'crewmate' }).eq('id', p.id)
    ))

    // Insert a copy of all tasks for each player individually
    const taskRows = players.flatMap(player =>
      TASK_POOL.map(t => ({
        game_id: game.id,
        player_id: player.id,
        name: t.name,
        emoji: t.emoji,
        description: t.description,
        is_complete: false,
      }))
    )
    await supabase.from('tasks').insert(taskRows)

    // Update game status — this triggers all clients to navigate
    await supabase.from('games').update({ status: 'playing' }).eq('id', game.id)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center">
        <p className="text-gray-400 animate-pulse text-lg">Loading lobby...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-red-400 text-xl mb-4">{error}</p>
          <button onClick={() => router.push('/')} className="text-gray-400 hover:text-white underline">Go Home</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0d0d1a] flex flex-col items-center px-6 py-10">
      {/* Header */}
      <div className="w-full max-w-sm">
        <p className="text-gray-400 text-xs uppercase tracking-widest text-center mb-1">Game Code</p>
        <div
          className="text-6xl font-black tracking-[0.2em] text-center py-3 rounded-xl bg-[#1a1a2e] border border-white/10"
          style={{ color: '#ef4444', textShadow: '0 0 20px rgba(239,68,68,0.5)' }}
        >
          {code}
        </div>
        <p className="text-gray-500 text-xs text-center mt-2">Share this code with friends</p>
      </div>

      {/* Waiting status */}
      <div className="mt-8 w-full max-w-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-bold uppercase tracking-wider text-sm">Players ({players.length})</h2>
          {players.length < 3 && (
            <span className="text-yellow-400 text-xs">Need {3 - players.length} more</span>
          )}
        </div>

        {/* Player list */}
        <div className="flex flex-col gap-2">
          {players.map(player => (
            <div
              key={player.id}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#1a1a2e] border border-white/5"
            >
              <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center" style={{ background: '#0d0d1a' }}>
                <img
                  src={`/sprites/${player.role === 'reactor_1' ? 'reactor1' : player.role === 'reactor_2' ? 'reactor2' : player.sprite}.png`}
                  className="w-full h-full object-contain"
                  style={{ mixBlendMode: 'screen' }}
                />
              </div>
              <span className="text-white font-medium">{player.name}</span>
              {(player.role === 'reactor_1' || player.role === 'reactor_2') && (
                <span className="text-cyan-400 text-xs font-bold uppercase">
                  ⚛️ {player.role === 'reactor_1' ? 'Reactor 1' : 'Reactor 2'}
                </span>
              )}
              {player.id === game?.host_id && (
                <span className="ml-auto text-yellow-400 text-xs font-bold uppercase">HOST</span>
              )}
              {player.id === myPlayerId && player.id !== game?.host_id && (
                <span className="ml-auto text-blue-400 text-xs">(you)</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Reactor selector */}
      {myPlayerId && (
        <div className="mt-6 w-full max-w-sm">
          {!reactorPickerOpen ? (
            <button
              onClick={() => setReactorPickerOpen(true)}
              className="w-full py-3 rounded-xl border text-sm font-bold uppercase tracking-wider transition-all active:scale-95"
              style={isReactor
                ? { background: '#0a1f2e', color: '#22d3ee', border: '1px solid #0e7490' }
                : { background: '#0d0d1a', color: '#6b7280', border: '1px solid rgba(255,255,255,0.1)' }
              }
            >
              {isReactor
                ? `⚛️ ${me?.role === 'reactor_1' ? 'Reactor 1' : 'Reactor 2'} — Change`
                : '⚛️ Make me a Reactor'}
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-gray-400 text-xs uppercase tracking-widest text-center mb-1">Select reactor slot</p>
              {(['reactor_1', 'reactor_2'] as const).map(slot => {
                const label = slot === 'reactor_1' ? 'Reactor 1' : 'Reactor 2'
                const taken = takenReactors.has(slot) && me?.role !== slot
                return (
                  <button
                    key={slot}
                    onClick={() => !taken && selectReactor(slot)}
                    disabled={taken || settingReactor}
                    className="w-full py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all active:scale-95 disabled:opacity-40"
                    style={{ background: '#0a1f2e', color: '#22d3ee', border: '1px solid #0e7490' }}
                  >
                    {taken ? `${label} — Taken` : label}
                  </button>
                )
              })}
              <button
                onClick={() => setReactorPickerOpen(false)}
                className="w-full py-2 text-gray-500 text-xs uppercase tracking-wider"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* Waiting indicator */}
      {!isHost && (
        <div className="mt-8 text-center">
          <div className="flex gap-1 justify-center mb-2">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-gray-500 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
          <p className="text-gray-400 text-sm">Waiting for host to start...</p>
        </div>
      )}

      {/* Start button (host only) */}
      {isHost && (
        <div className="mt-8 w-full max-w-sm">
          {players.length < 3 ? (
            <div className="text-center py-4 rounded-xl border border-dashed border-white/10 text-gray-500 text-sm">
              Need at least 3 players to start
            </div>
          ) : (
            <button
              onClick={startGame}
              disabled={starting}
              className="w-full py-4 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold text-lg tracking-wider uppercase transition-all active:scale-95 shadow-lg shadow-red-900/50"
            >
              {starting ? 'Starting...' : `Start Game (${players.length} players)`}
            </button>
          )}
          <p className="text-gray-500 text-xs text-center mt-2">You are the host</p>
        </div>
      )}
    </div>
  )
}
