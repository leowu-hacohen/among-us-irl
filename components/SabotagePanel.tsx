'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Sabotage } from '@/types/game'
import { playSabotage } from '@/lib/sounds'

interface Props {
  gameId: string
  playerId: string
  activeSabotage: Sabotage | null
}

const SABOTAGE_COOLDOWN = 20 // seconds

export default function SabotagePanel({ gameId, playerId, activeSabotage }: Props) {
  const [cooldown, setCooldown] = useState(0)
  const [triggering, setTriggering] = useState(false)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const isDisabled = triggering || cooldown > 0 || activeSabotage !== null

  async function triggerSabotage(type: string) {
    if (isDisabled) return
    setTriggering(true)
    playSabotage()
    await supabase.from('sabotages').insert({
      game_id: gameId,
      type,
      status: 'active',
      triggered_by: playerId,
    })
    setCooldown(SABOTAGE_COOLDOWN)
    setTriggering(false)
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-red-400 font-bold uppercase tracking-wider text-sm">Sabotage</h3>

      {activeSabotage && (
        <div className="px-3 py-2 rounded-lg bg-red-900/30 border border-red-700/50 text-red-300 text-sm">
          Active sabotage in progress... wait for crewmates to fix it.
        </div>
      )}

      {cooldown > 0 && (
        <div className="px-3 py-2 rounded-lg bg-[#1a1a2e] border border-white/10 text-gray-400 text-sm">
          Cooldown: {cooldown}s
        </div>
      )}

      <div className="grid grid-cols-1 gap-2">
        <button
          onClick={() => triggerSabotage('lights_out')}
          disabled={isDisabled}
          className="w-full py-3 rounded-xl bg-yellow-900/60 hover:bg-yellow-800/60 disabled:opacity-40 border border-yellow-700/30 text-yellow-300 font-bold text-sm uppercase tracking-wider transition-all active:scale-95"
        >
          ⚡ Lights Out
        </button>
        <button
          onClick={() => triggerSabotage('reactor')}
          disabled={isDisabled}
          className="w-full py-3 rounded-xl bg-orange-900/60 hover:bg-orange-800/60 disabled:opacity-40 border border-orange-700/30 text-orange-300 font-bold text-sm uppercase tracking-wider transition-all active:scale-95"
        >
          ☢️ Reactor Meltdown
        </button>
        <button
          onClick={() => triggerSabotage('comms')}
          disabled={isDisabled}
          className="w-full py-3 rounded-xl bg-blue-900/60 hover:bg-blue-800/60 disabled:opacity-40 border border-blue-700/30 text-blue-300 font-bold text-sm uppercase tracking-wider transition-all active:scale-95"
        >
          📡 Comms Sabotage
        </button>
      </div>
    </div>
  )
}
