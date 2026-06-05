'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { TASK_POOL } from '@/lib/tasks'
import { getConfig, impostorCount } from '@/lib/gameConfig'
import { pickBotSprite, spriteName } from '@/lib/sprites'
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
  const [impostorOverride, setImpostorOverride] = useState<number | null>(null)
  const [addingBots, setAddingBots] = useState(false)

  const isHost = game?.host_id === myPlayerId
  const isTest = !!game?.is_test

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

      if (gameData.status === 'playing') { router.push(`/game/${code}`); return }

      await fetchPlayers(gameData.id)
      setLoading(false)

      channel = supabase
        .channel(`lobby-${gameData.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `game_id=eq.${gameData.id}` }, () => {
          fetchPlayers(gameData.id)
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameData.id}` }, (payload) => {
          const updatedGame = payload.new as Game
          setGame(updatedGame)
          if (updatedGame.status === 'playing') router.push(`/game/${code}`)
        })
        .subscribe()
    }

    init()
    return () => { if (channel) supabase.removeChannel(channel) }
  }, [code, router, fetchGame, fetchPlayers])

  async function startGame() {
    const { minPlayers } = getConfig(game)
    if (!game || players.length < minPlayers) return
    setStarting(true)

    // Fresh fetch to avoid stale local state
    const { data: freshPlayers } = await supabase.from('players').select().eq('game_id', game.id)
    const roster = freshPlayers ?? players

    const shuffled = [...roster].sort(() => Math.random() - 0.5)
    const override = isTest && impostorOverride != null ? impostorOverride : undefined
    const impostorIds = new Set(shuffled.slice(0, impostorCount(roster.length, override)).map(p => p.id))
    await Promise.all(roster.map(p =>
      supabase.from('players').update({ role: impostorIds.has(p.id) ? 'impostor' : 'crewmate' }).eq('id', p.id)
    ))

    const taskRows = roster.flatMap(player => {
      const perPlayer = [...TASK_POOL].sort(() => Math.random() - 0.5)
      return perPlayer.map((t, i) => ({
        game_id: game.id,
        player_id: player.id,
        name: t.name,
        emoji: t.emoji,
        description: t.description,
        is_complete: false,
        task_order: i,
      }))
    })
    await supabase.from('tasks').insert(taskRows)
    await supabase.from('games').update({ status: 'playing' }).eq('id', game.id)
  }

  async function addBots(n: number) {
    if (!game || addingBots) return
    setAddingBots(true)
    const taken = players.map(p => p.sprite)
    const rows = []
    for (let i = 0; i < n; i++) {
      const sprite = pickBotSprite([...taken, ...rows.map(r => r.sprite)])
      rows.push({
        game_id: game.id,
        name: `Bot ${spriteName(sprite)}`,
        sprite,
        is_bot: true,
      })
    }
    await supabase.from('players').insert(rows)
    setAddingBots(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center">
        <p className="text-violet-400/70 animate-pulse text-lg">Loading lobby...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-red-400 text-xl mb-4">{error}</p>
          <button onClick={() => router.push('/')} className="text-violet-400/70 hover:text-white underline">Go Home</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0d0d1a] flex flex-col items-center px-6 py-10">
      <div className="w-full max-w-sm">
        <p className="text-violet-400/70 text-xs uppercase tracking-widest text-center mb-1">Game Code</p>
        <div
          className="text-6xl font-black tracking-[0.2em] text-center py-3 rounded-xl bg-[#1a1a2e] border border-white/10"
          style={{ color: '#ef4444', textShadow: '0 0 20px rgba(239,68,68,0.5)' }}
        >
          {code}
        </div>
        <p className="text-violet-400/50 text-xs text-center mt-2">Share this code with friends</p>
      </div>

      <div className="mt-8 w-full max-w-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-bold uppercase tracking-wider text-sm">Players ({players.length})</h2>
          {players.length < getConfig(game).minPlayers && (
            <span className="text-yellow-400 text-xs">Need {getConfig(game).minPlayers - players.length} more</span>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {players.map(player => (
            <div key={player.id}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#1a1a2e] border border-white/5">
              <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center" style={{ background: '#0d0d1a' }}>
                <img src={`/sprites/${player.sprite}.png`} className="w-full h-full object-contain" style={{ mixBlendMode: 'screen' }} />
              </div>
              <span className="text-white font-medium">{player.name}</span>
              {player.is_bot && (
                <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-purple-900/40 border border-purple-500/40 text-purple-300">
                  BOT
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

      {!isHost && (
        <div className="mt-8 text-center">
          <div className="flex gap-1 justify-center mb-2">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-violet-400/40 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
          <p className="text-violet-400/70 text-sm">Waiting for host to start...</p>
        </div>
      )}

      {isHost && isTest && (
        <div className="mt-6 w-full max-w-sm flex flex-col gap-3 p-4 rounded-xl border border-purple-500/30 bg-purple-950/20">
          <p className="text-purple-300 text-xs uppercase tracking-widest font-bold text-center">🧪 Test Mode</p>
          <div className="flex gap-2">
            <button onClick={() => addBots(1)} disabled={addingBots}
              className="flex-1 py-2 rounded-lg bg-purple-900/40 hover:bg-purple-900/60 disabled:opacity-40 border border-purple-500/40 text-purple-200 text-sm font-bold uppercase tracking-wider transition-all active:scale-95">
              + Add Bot
            </button>
            <button onClick={() => addBots(5)} disabled={addingBots}
              className="flex-1 py-2 rounded-lg bg-purple-900/40 hover:bg-purple-900/60 disabled:opacity-40 border border-purple-500/40 text-purple-200 text-sm font-bold uppercase tracking-wider transition-all active:scale-95">
              + 5 Bots
            </button>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-purple-300 text-xs uppercase tracking-wider">Impostors</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setImpostorOverride(v => Math.max(0, (v ?? impostorCount(players.length)) - 1))}
                className="w-8 h-8 rounded-lg bg-purple-900/40 border border-purple-500/40 text-purple-200 font-bold active:scale-95">−</button>
              <span className="text-white font-black w-8 text-center tabular-nums">
                {impostorOverride ?? impostorCount(players.length)}
              </span>
              <button onClick={() => setImpostorOverride(v => Math.min(players.length, (v ?? impostorCount(players.length)) + 1))}
                className="w-8 h-8 rounded-lg bg-purple-900/40 border border-purple-500/40 text-purple-200 font-bold active:scale-95">+</button>
              {impostorOverride != null && (
                <button onClick={() => setImpostorOverride(null)}
                  className="text-purple-400 text-xs uppercase tracking-wider ml-1 hover:text-purple-200">
                  reset
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {isHost && (
        <div className="mt-8 w-full max-w-sm">
          {players.length < getConfig(game).minPlayers ? (
            <div className="text-center py-4 rounded-xl border border-dashed border-white/10 text-violet-400/50 text-sm">
              Need at least {getConfig(game).minPlayers} players to start
            </div>
          ) : (
            <button onClick={startGame} disabled={starting}
              className="w-full py-4 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold text-lg tracking-wider uppercase transition-all active:scale-95 shadow-lg shadow-red-900/50">
              {starting ? 'Starting...' : `Start Game (${players.length} players)`}
            </button>
          )}
          <p className="text-violet-400/50 text-xs text-center mt-2">You are the host</p>
        </div>
      )}
    </div>
  )
}
