'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import VotingScreen from '@/components/VotingScreen'
import type { Player, Meeting } from '@/types/game'

export default function VotePage() {
  const router = useRouter()
  const params = useParams()
  const code = (params.code as string).toUpperCase()

  const [player, setPlayer] = useState<Player | null>(null)
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [gameId, setGameId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const playerId = localStorage.getItem('playerId')
    if (!playerId) { router.push('/'); return }

    async function init() {
      // Fetch game
      const { data: game, error: gameError } = await supabase
        .from('games')
        .select()
        .eq('code', code)
        .single()

      if (gameError || !game) { setError('Game not found'); setLoading(false); return }
      setGameId(game.id)

      // Fetch player
      const { data: playerData } = await supabase
        .from('players')
        .select()
        .eq('id', playerId)
        .single()

      if (!playerData) { setError('Player not found'); setLoading(false); return }
      setPlayer(playerData)

      // Fetch active meeting
      const { data: meetings } = await supabase
        .from('meetings')
        .select()
        .eq('game_id', game.id)
        .eq('status', 'voting')
        .order('created_at', { ascending: false })
        .limit(1)

      if (!meetings || meetings.length === 0) {
        // No active meeting, go back to game
        router.push(`/game/${code}`)
        return
      }

      setMeeting(meetings[0])
      setLoading(false)
    }

    init()
  }, [code, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center">
        <p className="text-yellow-400 animate-pulse text-lg font-bold uppercase tracking-wider">
          Emergency Meeting!
        </p>
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

  if (!player || !meeting || !gameId) return null

  return (
    <VotingScreen
      player={player}
      meeting={meeting}
      gameId={gameId}
      gameCode={code}
    />
  )
}
