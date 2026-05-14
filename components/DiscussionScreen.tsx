'use client'
import { useEffect, useState } from 'react'
import { playEmergencyMeeting } from '@/lib/sounds'

interface Props {
  gameCode: string
  callerName: string
  onEnd: () => void
  playSound?: boolean
}

const TOTAL = 120

export default function DiscussionScreen({ gameCode, callerName, onEnd, playSound = false }: Props) {
  const [seconds, setSeconds] = useState(TOTAL)

  useEffect(() => {
    if (playSound) playEmergencyMeeting()
  }, [playSound])

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          onEnd()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`
  const pct = (seconds / TOTAL) * 100

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-between px-6 py-10"
      style={{ background: 'linear-gradient(to bottom, #1a0000, #2d0000, #1a0000)' }}
    >
      {/* Top: header */}
      <div className="w-full max-w-sm text-center">
        <p className="text-red-400 text-xs uppercase tracking-[0.3em] mb-2 font-bold">Game Code: {gameCode}</p>
        <h1
          className="text-4xl font-black uppercase tracking-widest text-white"
          style={{ textShadow: '0 0 40px rgba(255,60,60,0.9)' }}
        >
          Emergency Meeting
        </h1>
        <p className="text-red-300 text-base mt-2 font-medium">
          Called by <span className="text-white font-bold">{callerName}</span>
        </p>
      </div>

      {/* Middle: timer */}
      <div className="flex flex-col items-center gap-4">
        <div
          className="text-8xl font-black tabular-nums"
          style={{
            color: seconds <= 30 ? '#ff4444' : '#ffffff',
            textShadow: seconds <= 30
              ? '0 0 40px rgba(255,0,0,0.9)'
              : '0 0 20px rgba(255,255,255,0.4)',
          }}
        >
          {timeStr}
        </div>

        {/* Timer bar */}
        <div className="w-64 h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{
              width: `${pct}%`,
              background: seconds <= 30 ? '#ef4444' : '#ffffff',
            }}
          />
        </div>

        <p className="text-red-300 text-sm uppercase tracking-widest">
          {seconds <= 0 ? 'Time\'s up!' : 'Discuss who the imposter is...'}
        </p>
      </div>

      {/* Bottom: end button */}
      <div className="w-full max-w-sm">
        <button
          onClick={onEnd}
          className="w-full py-4 rounded-xl bg-red-800 hover:bg-red-700 active:scale-95 text-white font-black text-lg uppercase tracking-widest transition-all shadow-lg shadow-red-900/60 border border-red-600/40"
        >
          End Discussion
        </button>
      </div>
    </div>
  )
}
