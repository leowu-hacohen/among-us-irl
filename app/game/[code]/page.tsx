'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import DiscussionScreen from '@/components/DiscussionScreen'
import TaskChecklist from '@/components/TaskChecklist'
import { playEmergencyMeeting, unlockAudio } from '@/lib/sounds'
import type { Player, Game } from '@/types/game'

type Screen = 'game' | 'discussion'

export default function GamePage() {
  const router = useRouter()
  const params = useParams()
  const code = (params.code as string).toUpperCase()

  const [player, setPlayer] = useState<Player | null>(null)
  const [game, setGame] = useState<Game | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [screen, setScreen] = useState<Screen>('game')
  const [meetingCallerName, setMeetingCallerName] = useState('')
  const [callingMeeting, setCallingMeeting] = useState(false)
  const [playSoundOnDiscussion, setPlaySoundOnDiscussion] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [currentMeetingId, setCurrentMeetingId] = useState('')
  const [isCaller, setIsCaller] = useState(false)
  const [confirmingKill, setConfirmingKill] = useState(false)


  useEffect(() => {
    const playerId = localStorage.getItem('playerId')
    if (!playerId) { router.push('/'); return }

    let channel: ReturnType<typeof supabase.channel> | null = null

    async function init() {
      // Fetch game
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select()
        .eq('code', code)
        .single()

      if (gameError || !gameData) { setError('Game not found'); setLoading(false); return }
      setGame(gameData)

      // Fetch player
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select()
        .eq('id', playerId)
        .single()

      if (playerError || !playerData) { setError('Player not found'); setLoading(false); return }
      setPlayer(playerData)
      setLoading(false)

      // Subscribe to meetings for this game
      channel = supabase
        .channel(`game-meetings-${gameData.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'meetings',
          filter: `game_id=eq.${gameData.id}`,
        }, async (payload) => {
          const meeting = payload.new
          if (meeting.status !== 'voting') return

          // Find caller name
          const { data: allPlayers } = await supabase
            .from('players')
            .select()
            .eq('game_id', gameData.id)
          const caller = allPlayers?.find((p: Player) => p.id === meeting.called_by)
          const callerName = caller?.name ?? 'Someone'

          // Skip if this client called the meeting (they already see it)
          const myId = localStorage.getItem('playerId')
          if (meeting.called_by === myId) return

          setMeetingCallerName(callerName)
          setCurrentMeetingId(meeting.id)
          setIsCaller(false)
          setPlaySoundOnDiscussion(true)
          setScreen('discussion')
        })
        .subscribe()
    }

    init()

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [code, router])

  async function callMeeting() {
    if (!game || !player || callingMeeting) return
    setCallingMeeting(true)

    // Play alarm immediately for the caller
    playEmergencyMeeting()

    // Insert meeting — this triggers the subscription on everyone else's phones
    await supabase.from('meetings').insert({
      game_id: game.id,
      type: 'emergency',
      called_by: player.id,
      reported_body: null,
      status: 'voting',
    })

    // Show discussion screen immediately for caller (skip alert)
    const { data: inserted } = await supabase.from('meetings').select('id').eq('game_id', game.id).order('created_at', { ascending: false }).limit(1).single()
    setCurrentMeetingId(inserted?.id ?? '')
    setIsCaller(true)
    setMeetingCallerName(player.name)
    setScreen('discussion')
    setCallingMeeting(false)
  }

  async function markSelfKilled() {
    if (!player) return
    await supabase.from('players').update({ is_alive: false }).eq('id', player.id)
    setPlayer({ ...player, is_alive: false })
    setConfirmingKill(false)
  }

  function handleDiscussionEnd() {
    setScreen('game')
    setMeetingCallerName('')
    setCurrentMeetingId('')
    setIsCaller(false)
    setPlaySoundOnDiscussion(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center">
        <p className="text-gray-400 animate-pulse text-lg">Loading game...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-red-400 text-xl mb-4">{error}</p>
          <button onClick={() => router.push('/')} className="text-gray-400 hover:text-white underline">Go Home</button>
        </div>
      </div>
    )
  }

  if (!player || !game) return null

  return (
    <>
      {screen === 'discussion' && (
        <DiscussionScreen
          gameCode={code}
          gameId={game.id}
          callerName={meetingCallerName}
          meetingId={currentMeetingId}
          isCaller={isCaller}
          playerId={player.id}
          onEnd={handleDiscussionEnd}
          playSound={playSoundOnDiscussion}
        />
      )}

      {/* Main game view — always rendered, overlaid when alert/discussion is shown */}
      <div className="min-h-screen bg-[#0d0d1a] flex flex-col pb-32">

        {/* Sound enable banner */}
        {!soundEnabled && (
          <button
            onClick={() => { unlockAudio(); setSoundEnabled(true) }}
            className="w-full py-3 text-center text-sm font-bold uppercase tracking-widest text-black animate-pulse"
            style={{ background: '#facc15' }}
          >
            🔔 Tap here to enable sound
          </button>
        )}

        {/* Header */}
        <div className="px-4 pt-8 pb-4 flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-widest">Playing as</p>
            <p className="text-white font-bold text-lg">{player.name}</p>
            {!player.is_alive ? (
              <span className="inline-flex items-center gap-1 mt-1 text-xs text-red-500 font-bold uppercase tracking-wider">
                ✕ Eliminated
              </span>
            ) : (
              <button
                onClick={() => setConfirmingKill(true)}
                className="mt-1 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider active:scale-95 transition-all"
                style={{ background: '#3f0000', color: '#f87171', border: '1px solid #7f1d1d' }}
              >
                ☠ Killed
              </button>
            )}
          </div>
          <div className="text-right">
            <p className="text-gray-500 text-xs uppercase tracking-widest">Game</p>
            <p
              className="text-2xl font-black tracking-widest"
              style={{ color: '#ef4444', textShadow: '0 0 12px rgba(239,68,68,0.5)' }}
            >
              {code}
            </p>
          </div>
        </div>

        {/* Kill confirmation modal */}
        {confirmingKill && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 px-6">
            <div className="bg-[#1a1a2e] rounded-2xl p-6 w-full max-w-sm border border-white/10 text-center flex flex-col gap-4">
              <p className="text-4xl">☠️</p>
              <p className="text-white font-bold text-lg">Mark yourself as killed?</p>
              <p className="text-gray-400 text-sm">You'll be X'd out in the next emergency meeting and won't be able to vote.</p>
              <button
                onClick={markSelfKilled}
                className="w-full py-4 rounded-xl font-black text-lg uppercase tracking-wider active:scale-95"
                style={{ background: 'linear-gradient(to bottom, #dc2626, #991b1b)', color: '#fff' }}
              >
                Confirm — I'm Dead
              </button>
              <button
                onClick={() => setConfirmingKill(false)}
                className="w-full py-3 text-gray-400 hover:text-white text-sm uppercase tracking-wider"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <TaskChecklist gameId={game.id} playerId={player.id} />
        </div>

        {/* Emergency meeting button — fixed at bottom */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#0d0d1a] via-[#0d0d1a]/95 to-transparent pt-8">
          <button
            onClick={callMeeting}
            disabled={callingMeeting || screen !== 'game'}
            className="w-full py-5 rounded-2xl font-black text-xl uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
            style={{
              background: 'linear-gradient(to bottom, #dc2626, #991b1b)',
              color: '#fff',
              boxShadow: '0 0 30px rgba(220,38,38,0.5), 0 4px 20px rgba(0,0,0,0.5)',
              textShadow: '0 1px 4px rgba(0,0,0,0.4)',
            }}
          >
            {callingMeeting ? 'Calling...' : '🚨 Emergency Meeting'}
          </button>
        </div>
      </div>
    </>
  )
}
