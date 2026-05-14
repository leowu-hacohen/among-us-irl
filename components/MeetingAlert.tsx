'use client'
import { useState } from 'react'
import { playEmergencyMeeting, playBodyReport } from '@/lib/sounds'

interface Props {
  type: 'emergency' | 'report'
  callerName: string
  reportedName?: string
  onDismiss: () => void
}

export default function MeetingAlert({ type, callerName, reportedName, onDismiss }: Props) {
  const [tapped, setTapped] = useState(false)

  function handleTap() {
    if (tapped) return
    setTapped(true)
    if (type === 'report') {
      playBodyReport()
    } else {
      playEmergencyMeeting()
    }
    setTimeout(onDismiss, 600)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 cursor-pointer select-none"
      style={{ background: type === 'report' ? 'rgba(120,0,0,0.97)' : 'rgba(20,20,60,0.97)' }}
      onClick={handleTap}
    >
      <div className="flex flex-col items-center gap-6 text-center max-w-sm w-full">
        <div className="text-8xl animate-bounce">
          {type === 'report' ? '🔴' : '🚨'}
        </div>

        <div>
          <h1
            className="text-4xl font-black uppercase tracking-widest text-white"
            style={{ textShadow: '0 0 30px rgba(255,100,100,1)' }}
          >
            {type === 'report' ? 'Body Reported!' : 'Emergency Meeting!'}
          </h1>
          <p className="text-red-200 text-lg mt-3 font-medium">
            {type === 'report'
              ? `${callerName} found ${reportedName ?? 'a body'}`
              : `${callerName} called a meeting`}
          </p>
        </div>

        <div
          className={`mt-4 w-full py-5 rounded-2xl font-black text-xl uppercase tracking-widest transition-all ${tapped ? 'bg-white/20 text-white/50' : 'bg-white text-red-700 animate-pulse'}`}
        >
          {tapped ? 'Going...' : 'TAP TO JOIN'}
        </div>
      </div>
    </div>
  )
}
