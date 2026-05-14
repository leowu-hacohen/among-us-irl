'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Player, Meeting, Vote } from '@/types/game'

interface Props {
  player: Player
  meeting: Meeting
  gameId: string
  gameCode: string
}

export default function VotingScreen({ player, meeting, gameId, gameCode }: Props) {
  const router = useRouter()
  const [alivePlayers, setAlivePlayers] = useState<Player[]>([])
  const [votes, setVotes] = useState<Vote[]>([])
  const [hasVoted, setHasVoted] = useState(false)
  const [voting, setVoting] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [callerName, setCallerName] = useState('')
  const [reportedName, setReportedName] = useState('')

  const isDead = !player.is_alive

  const fetchVotes = useCallback(async () => {
    const { data } = await supabase.from('votes').select().eq('meeting_id', meeting.id)
    if (data) setVotes(data)
    return data || []
  }, [meeting.id])

  const checkAllVoted = useCallback(async (currentVotes: Vote[], alive: Player[]) => {
    const voterIds = new Set(currentVotes.map(v => v.voter_id))
    const aliveIds = alive.filter(p => p.is_alive).map(p => p.id)
    const allVoted = aliveIds.every(id => voterIds.has(id))

    if (allVoted && alive.length > 0) {
      // Tally votes
      const tally: Record<string, number> = {}
      for (const vote of currentVotes) {
        if (vote.target_id) {
          tally[vote.target_id] = (tally[vote.target_id] || 0) + 1
        }
      }

      let maxVotes = 0
      let ejectedId: string | null = null
      let tie = false

      for (const [pid, count] of Object.entries(tally)) {
        if (count > maxVotes) {
          maxVotes = count
          ejectedId = pid
          tie = false
        } else if (count === maxVotes) {
          tie = true
        }
      }

      if (ejectedId && !tie) {
        const ejected = alive.find(p => p.id === ejectedId)
        if (ejected) {
          await supabase.from('players').update({ is_alive: false }).eq('id', ejectedId)
          setResult(`${ejected.name} was ejected! They were a ${ejected.role === 'impostor' ? 'IMPOSTOR' : 'CREWMATE'}.`)
        }
      } else {
        setResult('No one was ejected. (Tie or skip)')
      }

      // End meeting
      await supabase.from('meetings').update({ status: 'ended' }).eq('id', meeting.id)

      // Redirect after delay
      setTimeout(() => {
        router.push(`/game/${gameCode}`)
      }, 3500)
    }
  }, [meeting.id, gameCode, router])

  useEffect(() => {
    async function init() {
      const { data: players } = await supabase.from('players').select().eq('game_id', gameId)
      if (players) {
        setAlivePlayers(players.filter(p => p.is_alive))

        const caller = players.find(p => p.id === meeting.called_by)
        if (caller) setCallerName(caller.name)

        if (meeting.reported_body) {
          const body = players.find(p => p.id === meeting.reported_body)
          if (body) setReportedName(body.name)
        }
      }

      const currentVotes = await fetchVotes()
      const myVote = currentVotes.find(v => v.voter_id === player.id)
      if (myVote) setHasVoted(true)

      if (players) {
        await checkAllVoted(currentVotes, players.filter(p => p.is_alive))
      }
    }

    init()

    const channel = supabase
      .channel(`voting-${meeting.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'votes', filter: `meeting_id=eq.${meeting.id}` }, async () => {
        const updated = await fetchVotes()
        const { data: players } = await supabase.from('players').select().eq('game_id', gameId).eq('is_alive', true)
        if (players) {
          setAlivePlayers(players)
          await checkAllVoted(updated, players)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [meeting, player.id, gameId, gameCode, router, fetchVotes, checkAllVoted])

  async function castVote(targetId: string | null) {
    if (hasVoted || voting || isDead) return
    setVoting(true)
    const { error } = await supabase.from('votes').insert({
      meeting_id: meeting.id,
      voter_id: player.id,
      target_id: targetId,
    })
    if (!error) {
      setHasVoted(true)
      const updated = await fetchVotes()
      await checkAllVoted(updated, alivePlayers)
    }
    setVoting(false)
  }

  return (
    <div className="min-h-screen bg-[#0d0d1a] flex flex-col items-center px-4 py-8">
      {/* Result overlay */}
      {result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-6">
          <div className="text-center">
            <p className="text-3xl font-black text-white mb-2" style={{ textShadow: '0 0 20px rgba(255,255,255,0.4)' }}>
              {result}
            </p>
            <p className="text-gray-400 text-sm animate-pulse">Returning to game...</p>
          </div>
        </div>
      )}

      <div className="w-full max-w-sm flex flex-col gap-6">
        {/* Header */}
        <div className="text-center">
          <div
            className="text-4xl font-black uppercase tracking-widest text-white mb-1"
            style={{ textShadow: '0 0 20px rgba(255,200,0,0.5)' }}
          >
            {meeting.type === 'report' ? '🔴 Body Reported!' : '🚨 Emergency Meeting!'}
          </div>
          <p className="text-yellow-400 text-sm font-medium">
            {meeting.type === 'report'
              ? `${callerName} found ${reportedName}'s body`
              : `${callerName} called a meeting`}
          </p>
        </div>

        {isDead && (
          <div className="rounded-xl p-3 bg-gray-800/50 border border-gray-600/30 text-gray-400 text-center text-sm">
            You are dead. You cannot vote.
          </div>
        )}

        {/* Vote tally so far */}
        {votes.length > 0 && (
          <div className="text-center text-gray-400 text-sm">
            {votes.length} / {alivePlayers.length} have voted
          </div>
        )}

        {/* Voting options */}
        {!hasVoted && !isDead ? (
          <div className="flex flex-col gap-3">
            <p className="text-gray-300 text-sm text-center uppercase tracking-wider">Who is the impostor?</p>
            {alivePlayers.map(p => (
              <button
                key={p.id}
                onClick={() => castVote(p.id)}
                disabled={voting}
                className="w-full py-4 rounded-xl bg-[#1a1a2e] hover:bg-[#22223b] border border-white/10 text-white font-bold text-lg transition-all active:scale-95"
              >
                {p.name}
                {p.id === player.id && <span className="text-gray-400 font-normal text-sm"> (you)</span>}
              </button>
            ))}
            <button
              onClick={() => castVote(null)}
              disabled={voting}
              className="w-full py-3 rounded-xl bg-[#1a1a2e] hover:bg-[#22223b] border border-dashed border-white/20 text-gray-400 font-bold uppercase tracking-wider transition-all active:scale-95"
            >
              Skip Vote
            </button>
          </div>
        ) : (
          hasVoted && !result && (
            <div className="text-center py-8">
              <div className="flex gap-1 justify-center mb-3">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-yellow-400 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
              <p className="text-gray-300 text-lg font-medium">Vote submitted.</p>
              <p className="text-gray-500 text-sm mt-1">Waiting for others...</p>
              <p className="text-gray-600 text-xs mt-2">{votes.length}/{alivePlayers.length} voted</p>
            </div>
          )
        )}

        {/* Show player list for dead */}
        {isDead && (
          <div className="flex flex-col gap-2">
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Alive players</p>
            {alivePlayers.map(p => (
              <div key={p.id} className="px-4 py-3 rounded-xl bg-[#1a1a2e] border border-white/5 text-white">
                {p.name} {p.id === player.id ? '(you)' : ''}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
