'use client'
import { useEffect, useState } from 'react'
import { playEmergencyMeeting } from '@/lib/sounds'
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

export default function DiscussionScreen({
  gameCode, gameId, callerName, meetingId, isCaller, playerId, onEnd,
  playSound = false, meetingType = 'emergency', reportedBodyName = ''
}: Props) {
  const [timerRunning, setTimerRunning] = useState(false)
  const [seconds, setSeconds] = useState(TOTAL)
  const [starting, setStarting] = useState(false)
  const [players, setPlayers] = useState<Player[]>([])

  useEffect(() => { if (playSound) playEmergencyMeeting() }, [playSound])

  useEffect(() => {
    supabase.from('players').select().eq('game_id', gameId).then(({ data }) => {
      if (data) setPlayers(data)
    })
  }, [gameId])

  useEffect(() => {
    const channel = supabase
      .channel(`discussion-${meetingId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'meetings', filter: `id=eq.${meetingId}`,
      }, (payload) => {
        if (payload.new.status === 'timer_started') setTimerRunning(true)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [meetingId])

  useEffect(() => {
    if (!timerRunning) return
    const interval = setInterval(() => {
      setSeconds(prev => {
        if (prev <= 1) { clearInterval(interval); onEnd(); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [timerRunning, onEnd])

  async function startTimer() {
    setStarting(true)
    await supabase.from('meetings').update({ status: 'timer_started' }).eq('id', meetingId)
    setTimerRunning(true)
    setStarting(false)
  }

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
      ) : (
        <div className="flex items-center gap-3 my-2">
          <div className="text-4xl font-black tabular-nums"
            style={{ color: seconds <= 30 ? '#ff4444' : '#fff' }}>
            {timeStr}
          </div>
          <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-1000"
              style={{ width: `${pct}%`, background: seconds <= 30 ? '#ef4444' : '#fff' }} />
          </div>
        </div>
      )}

      {/* Player grid — display only */}
      <div className="grid grid-cols-3 gap-3 my-4">
        {players.map(p => {
          const isMe = p.id === playerId
          const isDead = !p.is_alive
          return (
            <div key={p.id}
              className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 ${
                isDead ? 'border-red-900/50 bg-black/40' :
                isMe ? 'border-blue-500/50 bg-blue-900/20' :
                'border-white/10 bg-white/5'
              }`}>
              <div className="w-14 h-14 rounded-full overflow-hidden relative flex items-center justify-center"
                style={{ background: '#0d0d1a', border: '2px solid rgba(255,255,255,0.1)' }}>
                <img src={`/sprites/${p.sprite}.png`} className="w-full h-full object-contain" style={{ mixBlendMode: 'screen' }} />
                {isDead && (
                  <div className="absolute inset-0 rounded-full bg-black/75 flex items-center justify-center">
                    <span className="text-red-500 text-2xl font-black leading-none">✕</span>
                  </div>
                )}
              </div>
              <p className={`text-xs font-bold truncate w-full text-center ${isDead ? 'text-red-700 line-through' : isMe ? 'text-blue-300' : 'text-white'}`}>
                {p.name}{isMe ? ' (you)' : ''}
              </p>
            </div>
          )
        })}
      </div>

      {/* Caller can end discussion early */}
      {isCaller && timerRunning && (
        <div className="mt-auto pt-4">
          <button onClick={onEnd}
            className="w-full py-4 rounded-xl font-black text-lg uppercase tracking-widest active:scale-95"
            style={{ background: 'linear-gradient(to bottom, #dc2626, #991b1b)', color: '#fff' }}>
            End Discussion
          </button>
        </div>
      )}
    </div>
  )
}
