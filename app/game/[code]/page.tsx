'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import CrewmateUI from '@/components/CrewmateUI'
import ImpostorUI from '@/components/ImpostorUI'
import type { Player, Game, Task, Sabotage } from '@/types/game'

export default function GamePage() {
  const router = useRouter()
  const params = useParams()
  const code = (params.code as string).toUpperCase()

  const [player, setPlayer] = useState<Player | null>(null)
  const [game, setGame] = useState<Game | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [gameOver, setGameOver] = useState<{ winner: 'crewmates' | 'impostors'; reason: string } | null>(null)

  const checkWinConditions = useCallback(async (gameId: string) => {
    const { data: players } = await supabase.from('players').select().eq('game_id', gameId)
    if (!players) return

    const alivePlayers = players.filter(p => p.is_alive)
    const aliveImpostors = alivePlayers.filter(p => p.role === 'impostor')
    const aliveCrewmates = alivePlayers.filter(p => p.role === 'crewmate')

    // Impostors win if alive impostors >= alive crewmates
    if (aliveImpostors.length > 0 && aliveImpostors.length >= aliveCrewmates.length) {
      await supabase.from('games').update({ status: 'ended' }).eq('id', gameId)
      setGameOver({ winner: 'impostors', reason: 'Impostors have overrun the crew!' })
      return
    }

    // Crewmates win if all impostors ejected
    if (aliveImpostors.length === 0) {
      await supabase.from('games').update({ status: 'ended' }).eq('id', gameId)
      setGameOver({ winner: 'crewmates', reason: 'All impostors have been ejected!' })
      return
    }

    // Check tasks complete
    const { data: tasks } = await supabase.from('tasks').select().eq('game_id', gameId)
    if (tasks && tasks.length > 0) {
      const allDone = tasks.every((t: Task) => t.is_complete)
      if (allDone) {
        await supabase.from('games').update({ status: 'ended' }).eq('id', gameId)
        setGameOver({ winner: 'crewmates', reason: 'All tasks completed!' })
      }
    }
  }, [])

  useEffect(() => {
    const playerId = localStorage.getItem('playerId')
    if (!playerId) { router.push('/'); return }

    let channel: ReturnType<typeof supabase.channel> | null = null

    async function init() {
      // Fetch game
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select()
        .eq('code', code)
        .single()

      if (gameError || !gameData) { setError('Game not found'); setLoading(false); return }
      setGame(gameData)

      if (gameData.status === 'ended') {
        setGameOver({ winner: 'crewmates', reason: 'Game over.' })
        setLoading(false)
        return
      }

      // Fetch player
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select()
        .eq('id', playerId)
        .single()

      if (playerError || !playerData) { setError('Player not found'); setLoading(false); return }
      setPlayer(playerData)
      setLoading(false)

      // Check win conditions initially
      await checkWinConditions(gameData.id)

      // Subscribe to all relevant tables
      channel = supabase
        .channel(`game-${gameData.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'meetings',
          filter: `game_id=eq.${gameData.id}`,
        }, (payload) => {
          const meeting = payload.new
          if (meeting.status === 'voting') {
            router.push(`/vote/${code}`)
          }
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameData.id}`,
        }, (payload) => {
          const updated = payload.new as Game
          setGame(updated)
          if (updated.status === 'ended') {
            setGameOver({ winner: 'crewmates', reason: 'Game ended.' })
          }
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'players',
          filter: `game_id=eq.${gameData.id}`,
        }, async () => {
          // Re-fetch my player
          const { data: updated } = await supabase.from('players').select().eq('id', playerId).single()
          if (updated) setPlayer(updated)
          await checkWinConditions(gameData.id)
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'tasks',
          filter: `game_id=eq.${gameData.id}`,
        }, async () => {
          await checkWinConditions(gameData.id)
        })
        .subscribe()
    }

    init()

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [code, router, checkWinConditions])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center">
        <p className="text-gray-400 animate-pulse text-lg">Loading game...</p>
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

  if (gameOver) {
    const isImpostor = player?.role === 'impostor'
    const won = (gameOver.winner === 'impostors' && isImpostor) || (gameOver.winner === 'crewmates' && !isImpostor)
    return (
      <div className="min-h-screen bg-[#0d0d1a] flex flex-col items-center justify-center px-6 text-center">
        <div className="flex flex-col items-center gap-6 max-w-sm w-full">
          <div className="text-7xl">{won ? '🎉' : '💀'}</div>
          <div>
            <h1
              className={`text-4xl font-black uppercase tracking-widest ${won ? 'text-green-400' : 'text-red-400'}`}
              style={{ textShadow: `0 0 20px ${won ? 'rgba(74,222,128,0.6)' : 'rgba(239,68,68,0.6)'}` }}
            >
              {won ? 'You Win!' : 'You Lose!'}
            </h1>
            <p className="text-xl font-bold text-white mt-2">
              {gameOver.winner === 'impostors' ? 'Impostors Win' : 'Crewmates Win'}
            </p>
          </div>
          <p className="text-gray-300 text-lg">{gameOver.reason}</p>
          <button
            onClick={() => router.push('/')}
            className="w-full py-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-lg uppercase tracking-wider transition-all active:scale-95"
          >
            Play Again
          </button>
        </div>
      </div>
    )
  }

  if (!player || !game) return null

  if (player.role === 'impostor') {
    return <ImpostorUI player={player} gameId={game.id} gameCode={code} />
  }

  return <CrewmateUI player={player} gameId={game.id} gameCode={code} />
}
