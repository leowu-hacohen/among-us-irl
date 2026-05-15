'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { playEmergencyMeeting, playRoleReveal } from '@/lib/sounds'
import { supabase } from '@/lib/supabase'
import type { Player } from '@/types/game'

interface Props {
  gameCode: string
  gameId: string
  callerName: string
  meetingId: string
  isCaller: boolean
  playerId: string
  onEnd: () => void
  playSound?: boolean
  meetingType?: 'emergency' | 'report'
  reportedBodyName?: string
}

const TOTAL = 120


type VotePhase = 'waiting' | 'voting' | 'confirming' | 'voted' | 'results'

interface VoteRecord { voter_id: string; target_id: string | null }
interface VoteResult { ejected: Player | null; tie: boolean; votes: VoteRecord[] }

export default function DiscussionScreen({
  gameCode, gameId, callerName, meetingId, isCaller, playerId, onEnd,
  playSound = false, meetingType = 'emergency', reportedBodyName = ''
}: Props) {
  const [timerRunning, setTimerRunning] = useState(false)
  const [seconds, setSeconds] = useState(TOTAL)
  const [starting, setStarting] = useState(false)
  const [players, setPlayers] = useState<Player[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [phase, setPhase] = useState<VotePhase>('waiting')
  const [votedPlayerIds, setVotedPlayerIds] = useState<Set<string>>(new Set())
  const [result, setResult] = useState<VoteResult | null>(null)
  const playersRef = useRef<Player[]>([])
  const tallyCalledRef = useRef(false)

  useEffect(() => { if (playSound) playEmergencyMeeting() }, [playSound])

  useEffect(() => {
    supabase.from('players').select().eq('game_id', gameId).then(({ data }) => {
      if (data) { setPlayers(data); playersRef.current = data }
    })
  }, [gameId])

  useEffect(() => { if (timerRunning) setPhase('voting') }, [timerRunning])
  useEffect(() => { if (phase === 'results') playRoleReveal() }, [phase])

  const tallyVotes = useCallback(async () => {
    if (tallyCalledRef.current) return
    tallyCalledRef.current = true

    console.log('[tallyVotes] gameId:', gameId, 'meetingId:', meetingId)

    const currentPlayers = playersRef.current

    // Auto-skip alive players who haven't voted (dead players don't vote)
    const { data: existingVotes } = await supabase.from('votes').select().eq('meeting_id', meetingId)
    const votes: VoteRecord[] = existingVotes ?? []
    const voterIds = new Set(votes.map(v => v.voter_id))
    const missing = currentPlayers.filter(p => p.is_alive && !voterIds.has(p.id) && p.role !== 'reactor_1' && p.role !== 'reactor_2')

    if (missing.length > 0) {
      const skipRows = missing.map(p => ({ meeting_id: meetingId, voter_id: p.id, target_id: null }))
      const { data: inserted } = await supabase.from('votes').upsert(skipRows, { onConflict: 'meeting_id,voter_id', ignoreDuplicates: true }).select()
      if (inserted) votes.push(...inserted)
    }

    // Tally
    const tally: Record<string, number> = {}
    let skipCount = 0
    for (const v of votes) {
      if (v.target_id) tally[v.target_id] = (tally[v.target_id] || 0) + 1
      else skipCount++
    }

    let maxVotes = 0
    let ejectedId: string | null = null
    let tie = false
    for (const [pid, count] of Object.entries(tally)) {
      if (count > maxVotes) { maxVotes = count; ejectedId = pid; tie = false }
      else if (count === maxVotes) { tie = true }
    }

    // Skips >= top vote count → no ejection
    if (skipCount >= maxVotes) {
      ejectedId = null
      tie = maxVotes > 0 && skipCount === maxVotes
    }

    const ejected = ejectedId && !tie ? currentPlayers.find(p => p.id === ejectedId) ?? null : null
    if (ejected) {
      await supabase.from('players').update({ is_alive: false }).eq('id', ejected.id)

      // Win condition: if ejected player was an impostor, check if any impostors remain
      if (ejected.role === 'impostor') {
        const { data: alivePlayers } = await supabase
          .from('players').select('role').eq('game_id', gameId).eq('is_alive', true)
        const aliveImpostors = alivePlayers?.filter(p => p.role === 'impostor') ?? []
        if (aliveImpostors.length === 0) {
          await supabase.from('games')
            .update({ game_over: true, winning_team: 'crewmates' })
            .eq('id', gameId)
            .eq('game_over', false)
        }
      }

      // Win condition: impostors >= crewmates after ejection
      const { data: remaining } = await supabase
        .from('players').select('role')
        .eq('game_id', gameId).eq('is_alive', true)
      if (remaining) {
        const aliveImpostors = remaining.filter(p => p.role === 'impostor').length
        const aliveCrewmates = remaining.filter(p => p.role === 'crewmate').length
        console.log('[tallyVotes] parity check — aliveImpostors:', aliveImpostors, 'aliveCrewmates:', aliveCrewmates, 'gameId:', gameId)
        if (aliveImpostors >= aliveCrewmates && aliveImpostors > 0) {
          await supabase.from('games')
            .update({ game_over: true, winning_team: 'impostors' })
            .eq('id', gameId).eq('game_over', false)
        }
      }
    }
    setResult({ ejected, tie: tie || maxVotes === 0, votes })
    setPhase('results')
    setTimeout(onEnd, 6000)
  }, [meetingId, onEnd, gameId])

  // Subscribe to meeting timer + votes
  useEffect(() => {
    const channel = supabase
      .channel(`discussion-${meetingId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'meetings', filter: `id=eq.${meetingId}`,
      }, (payload) => {
        if (payload.new.status === 'timer_started') setTimerRunning(true)
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'votes', filter: `meeting_id=eq.${meetingId}`,
      }, (payload) => {
        setVotedPlayerIds(prev => {
          const next = new Set([...prev, payload.new.voter_id])
          // Tally immediately when all alive players have voted
          const alivePlayers = playersRef.current.filter(p => p.is_alive && p.role !== 'reactor_1' && p.role !== 'reactor_2')
          if (alivePlayers.length > 0 && next.size >= alivePlayers.length) {
            tallyVotes()
          }
          return next
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [meetingId, tallyVotes])

  // Countdown — tally when timer hits 0
  useEffect(() => {
    if (!timerRunning) return
    const interval = setInterval(() => {
      setSeconds(prev => {
        if (prev <= 1) { clearInterval(interval); tallyVotes(); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [timerRunning, tallyVotes])

  async function startTimer() {
    setStarting(true)
    await supabase.from('meetings').update({ status: 'timer_started' }).eq('id', meetingId)
    setTimerRunning(true)
    setStarting(false)
  }

  async function submitVote(targetId: string | null) {
    setPhase('voted')
    await supabase.from('votes').insert({ meeting_id: meetingId, voter_id: playerId, target_id: targetId })
  }

  const myVoted = votedPlayerIds.has(playerId)
  const iAmAlive = players.find(p => p.id === playerId)?.is_alive ?? true
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`
  const pct = (seconds / TOTAL) * 100

  return (
    <div className="fixed inset-0 z-50 flex flex-col px-4 py-8 overflow-y-auto"
      style={{ background: 'linear-gradient(to bottom, #1a0000, #2d0000, #1a0000)' }}>

      {/* Header */}
      <div className="text-center mb-4">
        <p className="text-red-400 text-xs uppercase tracking-[0.3em] mb-1 font-bold">Game: {gameCode}</p>
        {meetingType === 'report' ? (
          <>
            <h1 className="text-3xl font-black uppercase tracking-widest text-white"
              style={{ textShadow: '0 0 30px rgba(255,60,60,0.9)' }}>
              Body Reported
            </h1>
            <p className="text-red-300 text-sm mt-1">
              Body of <span className="text-white font-bold">{reportedBodyName}</span> reported by <span className="text-white font-bold">{callerName}</span>
            </p>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-black uppercase tracking-widest text-white"
              style={{ textShadow: '0 0 30px rgba(255,60,60,0.9)' }}>
              Emergency Meeting
            </h1>
            <p className="text-red-300 text-sm mt-1">Called by <span className="text-white font-bold">{callerName}</span></p>
          </>
        )}
      </div>

      {/* Timer */}
      {!timerRunning ? (
        <div className="text-center flex flex-col items-center gap-4 my-4">
          <p className="text-red-300 text-sm uppercase tracking-widest animate-pulse">
            {isCaller ? 'Everyone here? Start the timer.' : `Waiting for ${callerName} to start...`}
          </p>
          {isCaller && (
            <button onClick={startTimer} disabled={starting}
              className="px-8 py-4 rounded-2xl font-black text-lg uppercase tracking-widest active:scale-95 disabled:opacity-50"
              style={{ background: 'linear-gradient(to bottom, #16a34a, #15803d)', color: '#fff', boxShadow: '0 0 20px rgba(22,163,74,0.5)' }}>
              {starting ? 'Starting...' : '▶ Start Timer'}
            </button>
          )}
        </div>
      ) : phase !== 'results' && (
        <div className="flex items-center gap-3 my-2">
          <div className="text-4xl font-black tabular-nums"
            style={{ color: seconds <= 30 ? '#ff4444' : '#fff' }}>
            {timeStr}
          </div>
          <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-1000"
              style={{ width: `${pct}%`, background: seconds <= 30 ? '#ef4444' : '#fff' }} />
          </div>
          <span className="text-gray-400 text-xs whitespace-nowrap">{votedPlayerIds.size}/{players.length} voted</span>
        </div>
      )}

      {/* Results — vote reveal */}
      {phase === 'results' && result && (
        <div className="flex flex-col gap-4 my-2">
          <div className="text-center py-4 rounded-2xl bg-black/40 border border-white/10">
            <p className="text-4xl mb-2">{result.ejected ? '💀' : '😮'}</p>
            <p className="text-2xl font-black text-white uppercase tracking-wider">
              {result.ejected ? `${result.ejected.name} ejected!` : 'No one ejected.'}
            </p>
            {result.tie && <p className="text-red-300 text-sm mt-1">It was a tie.</p>}
            <p className="text-gray-400 text-xs mt-2 animate-pulse">Returning to game...</p>
          </div>

          {/* Who voted for whom */}
          <div className="flex flex-col gap-2">
            <p className="text-gray-400 text-xs uppercase tracking-widest text-center">Votes revealed</p>
            {result.votes.map(v => {
              const voter = players.find(p => p.id === v.voter_id)
              const target = players.find(p => p.id === v.target_id)
              if (!voter) return null
              return (
                <div key={v.voter_id} className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/5 border border-white/10">
                  <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center" style={{ background: '#0d0d1a' }}>
                    <img src={`/sprites/${voter.sprite}.png`} className="w-full h-full object-contain" style={{ mixBlendMode: 'screen' }} />
                  </div>
                  <span className="text-white text-sm font-medium flex-1">{voter.name}</span>
                  <span className="text-gray-500 text-xs">→</span>
                  {target ? (
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center" style={{ background: '#0d0d1a' }}>
                        <img src={`/sprites/${target.sprite}.png`} className="w-full h-full object-contain" style={{ mixBlendMode: 'screen' }} />
                      </div>
                      <span className="text-red-300 text-sm font-bold">{target.name}</span>
                    </div>
                  ) : (
                    <span className="text-gray-400 text-sm italic">Skipped</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Player grid */}
      {phase !== 'results' && (
        <div className="grid grid-cols-3 gap-3 my-4">
          {players.filter(p => p.role !== 'reactor_1' && p.role !== 'reactor_2').map(p => {
            const isSelected = selectedId === p.id
            const hasVoted = votedPlayerIds.has(p.id)
            const isMe = p.id === playerId
            const isDead = !p.is_alive
            const selectable = phase === 'voting' && !myVoted && !isMe && !isDead && iAmAlive
            return (
              <button key={p.id}
                onClick={() => selectable && setSelectedId(isSelected ? null : p.id)}
                disabled={!selectable}
                className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all active:scale-95 ${
                  isDead ? 'border-red-900/50 bg-black/40' :
                  isSelected ? 'border-yellow-400 bg-yellow-400/10' :
                  isMe ? 'border-blue-500/50 bg-blue-900/20' :
                  'border-white/10 bg-white/5'
                } ${!selectable ? 'opacity-70' : ''}`}>
                <div className="w-14 h-14 rounded-full overflow-hidden relative flex items-center justify-center"
                  style={{ background: '#0d0d1a', border: isSelected ? '2px solid #facc15' : '2px solid rgba(255,255,255,0.1)' }}>
                  <img src={`/sprites/${p.sprite}.png`} className="w-full h-full object-contain" style={{ mixBlendMode: 'screen' }} />
                  {isDead && (
                    <div className="absolute inset-0 rounded-full bg-black/75 flex items-center justify-center">
                      <span className="text-red-500 text-2xl font-black leading-none">✕</span>
                    </div>
                  )}
                  {!isDead && hasVoted && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
                <p className={`text-xs font-bold truncate w-full text-center ${isDead ? 'text-red-700 line-through' : isMe ? 'text-blue-300' : 'text-white'}`}>
                  {p.name}{isMe ? ' (you)' : ''}
                </p>
              </button>
            )
          })}
        </div>
      )}

      {/* Confirm overlay */}
      {phase === 'confirming' && selectedId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 px-6">
          <div className="bg-[#1a1a2e] rounded-2xl p-6 w-full max-w-sm border border-white/10 text-center flex flex-col gap-4">
            <p className="text-white font-bold text-lg">Vote for <span className="text-yellow-400">{players.find(p => p.id === selectedId)?.name}</span>?</p>
            <button onClick={() => submitVote(selectedId)}
              className="w-full py-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-lg uppercase tracking-wider active:scale-95">
              Confirm Vote
            </button>
            <button onClick={() => setPhase('voting')}
              className="w-full py-3 text-gray-400 hover:text-white text-sm uppercase tracking-wider">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Bottom actions */}
      {phase === 'voting' && !myVoted && iAmAlive && (
        <div className="flex flex-col gap-3 mt-auto pt-4">
          <button onClick={() => selectedId && setPhase('confirming')} disabled={!selectedId}
            className="w-full py-4 rounded-xl font-black text-lg uppercase tracking-widest active:scale-95 disabled:opacity-30 transition-all"
            style={{ background: selectedId ? 'linear-gradient(to bottom, #dc2626, #991b1b)' : '#374151', color: '#fff' }}>
            Vote
          </button>
          <button onClick={() => submitVote(null)}
            className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 font-bold uppercase tracking-wider active:scale-95 border border-white/10">
            Skip Vote
          </button>
        </div>
      )}
      {phase === 'voting' && !iAmAlive && (
        <p className="text-center text-red-700 text-sm uppercase tracking-wider mt-auto pt-4">
          You were ejected. You may not vote.
        </p>
      )}
      {(phase === 'voted' || myVoted) && iAmAlive && phase !== 'results' && (
        <p className="text-center text-gray-400 text-sm animate-pulse uppercase tracking-wider mt-auto pt-4">
          Vote submitted. Waiting for others...
        </p>
      )}
    </div>
  )
}
