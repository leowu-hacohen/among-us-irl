'use client'
import type { Game } from '@/types/game'

interface Props {
  game: Game
  timeLeft: number
}

export default function ReactorOverlay({ game, timeLeft }: Props) {
  const mins = Math.floor(timeLeft / 60)
  const secs = timeLeft % 60
  const timerStr = `${mins}:${secs.toString().padStart(2, '0')}`
  const urgent = timeLeft <= 30

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 px-6 gap-5">
      <p className="text-xs uppercase tracking-[0.3em] text-red-400 font-bold animate-pulse">⚠ Warning</p>
      <p
        className="text-3xl font-black uppercase tracking-widest text-center"
        style={{ color: '#ef4444', textShadow: '0 0 30px rgba(239,68,68,0.7)' }}
      >
        Reactor Sabotaged
      </p>
      <p className="text-gray-400 text-sm text-center">Fix both reactor stations before time runs out</p>

      <div
        className="text-7xl font-black tabular-nums mt-2"
        style={{
          color: urgent ? '#ef4444' : '#facc15',
          textShadow: `0 0 30px ${urgent ? 'rgba(239,68,68,0.7)' : 'rgba(250,204,21,0.7)'}`,
        }}
      >
        {timerStr}
      </div>

      <div className="flex gap-4 mt-2">
        {(['A', 'B'] as const).map(s => {
          const done = s === 'A' ? game.reactor_station_a_complete : game.reactor_station_b_complete
          return (
            <div
              key={s}
              className={`px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wider border ${
                done
                  ? 'bg-green-900/40 border-green-700/50 text-green-400'
                  : 'bg-red-900/20 border-red-800/50 text-red-400'
              }`}
            >
              Station {s}: {done ? '✓ Complete' : 'Incomplete'}
            </div>
          )
        })}
      </div>
    </div>
  )
}
