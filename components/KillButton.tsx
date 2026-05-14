'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Player } from '@/types/game'

interface Props {
  target: Player
  onKill: (targetId: string) => void
  killCooldown: number
  setKillCooldown: (v: number) => void
}

export default function KillButton({ target, onKill, killCooldown, setKillCooldown }: Props) {
  const [killing, setKilling] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  async function handleKill() {
    if (killing || killCooldown > 0) return
    setKilling(true)
    await supabase.from('players').update({ is_alive: false }).eq('id', target.id)
    setConfirmed(true)
    setKillCooldown(30)
    onKill(target.id)
    setTimeout(() => setConfirmed(false), 2000)
    setKilling(false)
  }

  if (confirmed) {
    return (
      <span className="px-3 py-1 rounded-lg bg-red-900/50 text-red-400 text-xs font-bold uppercase">
        Eliminated
      </span>
    )
  }

  return (
    <button
      onClick={handleKill}
      disabled={killing || killCooldown > 0}
      className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-bold text-xs uppercase tracking-wider transition-all active:scale-95"
    >
      {killCooldown > 0 ? `${killCooldown}s` : 'KILL'}
    </button>
  )
}
