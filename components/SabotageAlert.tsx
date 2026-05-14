'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Sabotage } from '@/types/game'
import { playSabotage } from '@/lib/sounds'

interface Props {
  sabotage: Sabotage
  playerId: string
  onFixed: () => void
}

const SABOTAGE_INFO: Record<string, { icon: string; title: string; instruction: string }> = {
  lights_out: {
    icon: '⚡',
    title: 'LIGHTS OUT',
    instruction: 'Stop all tasks! Find the electrical panel and scan the QR code to restore power!',
  },
  reactor: {
    icon: '☢️',
    title: 'REACTOR MELTDOWN',
    instruction: 'CRITICAL! Get to the reactor room and enter the shutdown code NOW!',
  },
  comms: {
    icon: '📡',
    title: 'COMMS SABOTAGE',
    instruction: 'Communications are down! Find the comms terminal and restore the signal.',
  },
}

export default function SabotageAlert({ sabotage, playerId, onFixed }: Props) {
  const [countdown, setCountdown] = useState(45)
  const [fixing, setFixing] = useState(false)

  const info = SABOTAGE_INFO[sabotage.type] || {
    icon: '⚠️',
    title: 'SABOTAGE',
    instruction: 'Find and fix the sabotage immediately!',
  }

  useEffect(() => { playSabotage() }, [])

  // Countdown for reactor
  useEffect(() => {
    if (sabotage.type !== 'reactor') return
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [sabotage.type, countdown])

  async function fixSabotage() {
    setFixing(true)
    await supabase.from('sabotages').update({ status: 'fixed' }).eq('id', sabotage.id)
    onFixed()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 animate-pulse-slow"
      style={{ background: 'rgba(180,0,0,0.85)', backdropFilter: 'blur(4px)' }}>
      {/* Flashing border */}
      <div className="absolute inset-0 border-4 border-red-400 animate-ping rounded-none opacity-30 pointer-events-none" />

      <div className="relative z-10 text-center flex flex-col items-center gap-6 max-w-sm w-full">
        <div className="text-6xl animate-bounce">{info.icon}</div>

        <div>
          <h1
            className="text-4xl font-black tracking-widest uppercase text-white"
            style={{ textShadow: '0 0 30px rgba(255,100,100,1)' }}
          >
            {info.title}
          </h1>
        </div>

        {sabotage.type === 'reactor' && (
          <div className={`text-6xl font-black ${countdown <= 10 ? 'text-yellow-300 animate-pulse' : 'text-white'}`}>
            {String(Math.floor(countdown / 60)).padStart(2, '0')}:{String(countdown % 60).padStart(2, '0')}
          </div>
        )}

        <p className="text-red-100 text-lg font-medium leading-relaxed">{info.instruction}</p>

        <button
          onClick={fixSabotage}
          disabled={fixing}
          className="w-full py-4 rounded-xl bg-white text-red-700 font-black text-xl uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 shadow-2xl"
        >
          {fixing ? 'Fixing...' : `Fix ${info.title}`}
        </button>
      </div>
    </div>
  )
}
