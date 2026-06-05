'use client'
import { useState, useEffect } from 'react'
import { getConfig } from '@/lib/gameConfig'
import { clearReactor, completeReactorStation, failReactor } from '@/lib/gameActions'
import type { Game } from '@/types/game'

interface Props {
  game: Game
  stationSlot: 'reactor_1' | 'reactor_2'
}

export default function ReactorStation({ game, stationSlot }: Props) {
  const { reactorDurationSeconds } = getConfig(game)
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [timeLeft, setTimeLeft] = useState(reactorDurationSeconds)
  const [fixing, setFixing] = useState(false)

  const isA = stationSlot === 'reactor_1'
  const slot: 'A' | 'B' = isA ? 'A' : 'B'
  const stationLabel = slot
  const myCode = isA ? game.reactor_code_a : game.reactor_code_b
  const correctInput = isA ? game.reactor_code_b : game.reactor_code_a
  const myComplete = isA ? game.reactor_station_a_complete : game.reactor_station_b_complete

  useEffect(() => {
    if (game.current_sabotage !== 'reactor' || !game.reactor_started_at || game.game_over) {
      setTimeLeft(reactorDurationSeconds)
      return
    }
    const interval = setInterval(() => {
      const elapsed = (Date.now() - new Date(game.reactor_started_at!).getTime()) / 1000
      const tl = Math.max(0, reactorDurationSeconds - Math.floor(elapsed))
      setTimeLeft(tl)
      if (tl <= 0) {
        clearInterval(interval)
        failReactor(game.id)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [game.current_sabotage, game.reactor_started_at, game.id, game.game_over, reactorDurationSeconds])

  async function manualFix() {
    if (fixing) return
    setFixing(true)
    await clearReactor(game.id)
    setFixing(false)
  }

  async function submitCode() {
    if (submitting || !myCode) return
    setSubmitting(true)
    setError('')

    if (input !== correctInput) {
      setError('Wrong code. Try again.')
      setSubmitting(false)
      return
    }

    await completeReactorStation(game.id, slot)
    setSubmitting(false)
  }

  if (game.current_sabotage !== 'reactor') {
    return (
      <div className="min-h-screen bg-[#0d0d1a] flex flex-col items-center justify-center px-6 gap-4">
        <p className="text-6xl">⚛️</p>
        <p
          className="text-3xl font-black uppercase tracking-widest"
          style={{ color: '#22d3ee', textShadow: '0 0 20px rgba(34,211,238,0.5)' }}
        >
          Reactor {isA ? '1' : '2'}
        </p>
        <p className="text-gray-500 text-sm uppercase tracking-widest">Standby</p>
      </div>
    )
  }

  const mins = Math.floor(timeLeft / 60)
  const secs = timeLeft % 60
  const timerStr = `${mins}:${secs.toString().padStart(2, '0')}`
  const urgent = timeLeft <= 30

  return (
    <div className="min-h-screen bg-[#0d0d1a] flex flex-col items-center justify-center px-6 gap-5">
      <p className="text-xs uppercase tracking-[0.3em] text-red-400 font-bold animate-pulse">⚠ Reactor Sabotaged</p>
      <p className="text-2xl font-black uppercase tracking-widest text-white">Station {stationLabel}</p>

      <div
        className="text-5xl font-black tabular-nums"
        style={{
          color: urgent ? '#ef4444' : '#facc15',
          textShadow: `0 0 20px ${urgent ? 'rgba(239,68,68,0.6)' : 'rgba(250,204,21,0.6)'}`,
        }}
      >
        {timerStr}
      </div>

      {/* Code always visible so players can relay it even after completing */}
      <div className="flex flex-col items-center gap-1">
        <p className="text-xs text-gray-500 uppercase tracking-widest">Reset Code</p>
        <p
          className="text-6xl font-black tracking-[0.25em] text-white"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {myCode}
        </p>
        <p className="text-xs text-gray-600 mt-1">Crewmates must enter this code at the other station</p>
      </div>

      {myComplete ? (
        <div className="flex flex-col items-center gap-2">
          <p className="text-4xl">✅</p>
          <p className="text-green-400 font-black text-xl uppercase tracking-widest">Station {stationLabel} Complete</p>
          <p className="text-gray-500 text-sm">Waiting for the other station...</p>
        </div>
      ) : (
        <div className="w-full max-w-xs flex flex-col gap-2">
          <p className="text-xs text-gray-400 uppercase tracking-widest text-center">Enter Code</p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={4}
            value={input}
            onChange={e => { setInput(e.target.value.replace(/\D/g, '').slice(0, 4)); setError('') }}
            placeholder="_ _ _ _"
            className="w-full text-center text-3xl font-black py-4 rounded-xl bg-[#1a1a2e] border border-white/20 text-white tracking-[0.3em] focus:outline-none focus:border-cyan-500"
          />
          {error && <p className="text-red-400 text-sm text-center font-medium">{error}</p>}
          <button
            onClick={submitCode}
            disabled={input.length !== 4 || submitting}
            className="w-full py-4 rounded-xl font-black text-lg uppercase tracking-widest disabled:opacity-40 transition-all active:scale-95"
            style={{ background: 'linear-gradient(to bottom, #0891b2, #0e7445)', color: '#fff' }}
          >
            {submitting ? 'Checking...' : 'Submit'}
          </button>
        </div>
      )}

      <button
        onClick={manualFix}
        disabled={fixing}
        className="w-full max-w-xs py-4 rounded-xl font-black text-lg uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 mt-2"
        style={{ background: 'linear-gradient(to bottom, #16a34a, #15803d)', color: '#fff' }}
      >
        {fixing ? 'Fixing...' : '✅ Reactor Fixed'}
      </button>

      <div className="flex gap-3">
        {(['A', 'B'] as const).map(s => {
          const done = s === 'A' ? game.reactor_station_a_complete : game.reactor_station_b_complete
          return (
            <div
              key={s}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border ${
                done
                  ? 'bg-green-450/40 border-green-700/50 text-green-400'
                  : 'bg-white/5 border-white/10 text-gray-500'
              }`}
            >
              Station {s}: {done ? 'Complete' : 'Incomplete'}
            </div>
          )
        })}
      </div>
    </div>
  )
}
