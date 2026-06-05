'use client'
import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { unlockAudio } from '@/lib/sounds'
import { getConfig } from '@/lib/gameConfig'
import { PLAYER_SPRITES, spriteName } from '@/lib/sprites'

function generateCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const length = getConfig().gameCodeLength
  let code = ''
  for (let i = 0; i < length; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export default function Home() {
  const router = useRouter()
  const [selectedIndex, setSelectedIndex] = useState(0)
  const selectedSprite = PLAYER_SPRITES[selectedIndex]
  const [code, setCode] = useState('')
  const [mode, setMode] = useState<'home' | 'join'>('home')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const touchStartX = useRef<number | null>(null)
  const N = PLAYER_SPRITES.length

  // Stable star field: positions, sizes, twinkle timing all fixed once on mount.
  const stars = useMemo(() => Array.from({ length: 80 }, () => ({
    size: Math.random() * 2 + 1,
    top: Math.random() * 100,
    left: Math.random() * 100,
    dur: 6 + Math.random() * 8,
    delay: Math.random() * 8,
    dx: (Math.random() - 0.5) * 80,
    dy: (Math.random() - 0.5) * 80,
  })), [])

  function go(delta: number) {
    setSelectedIndex(i => ((i + delta) % N + N) % N)
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current == null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1)
  }

  async function createGame(isTest = false) {
    if (!selectedSprite) return
    unlockAudio()
    setLoading(true)
    setError('')
    const gameCode = generateCode()
    const { data: game, error: gameError } = await supabase
      .from('games')
      .insert({ code: gameCode, status: 'lobby', task_count: getConfig().defaultTaskCount, is_test: isTest })
      .select()
      .single()
    if (gameError || !game) { setError('Failed to create game'); setLoading(false); return }
    const { data: player, error: playerError } = await supabase
      .from('players')
      .insert({ game_id: game.id, name: spriteName(selectedSprite), sprite: selectedSprite })
      .select()
      .single()
    if (playerError || !player) { setError('Failed to create player'); setLoading(false); return }
    await supabase.from('games').update({ host_id: player.id }).eq('id', game.id)
    localStorage.setItem('playerId', player.id)
    localStorage.setItem('gameCode', gameCode)
    router.push(`/lobby/${gameCode}`)
  }

  async function joinGame() {
    if (!selectedSprite || !code.trim()) return
    unlockAudio()
    setLoading(true)
    setError('')
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select()
      .eq('code', code.toUpperCase())
      .single()
    if (gameError || !game) { setError('Game not found'); setLoading(false); return }
    if (game.status !== 'lobby') { setError('Game already started'); setLoading(false); return }
    const { data: player, error: playerError } = await supabase
      .from('players')
      .insert({ game_id: game.id, name: spriteName(selectedSprite), sprite: selectedSprite })
      .select()
      .single()
    if (playerError || !player) { setError('Failed to join'); setLoading(false); return }
    localStorage.setItem('playerId', player.id)
    localStorage.setItem('gameCode', code.toUpperCase())
    router.push(`/lobby/${code.toUpperCase()}`)
  }

  return (
    <div className="min-h-screen bg-[#0d0d1a] flex flex-col items-center px-4 py-8">
      {/* Stars */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {stars.map((s, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              width: s.size + 'px',
              height: s.size + 'px',
              top: s.top + '%',
              left: s.left + '%',
              animation: `twinkle ${s.dur}s ease-in-out ${s.delay}s infinite`,
              ['--dx' as string]: `${s.dx}px`,
              ['--dy' as string]: `${s.dy}px`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 w-full max-w-sm flex flex-col items-center gap-6">
        {/* Title */}
        <div className="text-center">
          <h1
            className="text-5xl font-black tracking-widest uppercase"
            style={{ color: '#ef4444', textShadow: '0 0 20px rgba(239,68,68,0.8), 0 0 40px rgba(239,68,68,0.4)' }}
          >
            AMONG
          </h1>
          <h1
            className="text-5xl font-black tracking-widest uppercase"
            style={{ color: 'white', textShadow: '0 0 20px rgba(255,255,255,0.4)' }}
          >
            US IRL
          </h1>
          <p
            className="mt-3 text-violet-400/60 text-[11px] font-light text-center"
            style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.18em' }}
          >
            find the impostor
          </p>
        </div>

        {/* Character carousel */}
        <div className="w-full flex flex-col items-center gap-3">
          <p
            className="text-violet-300 text-base font-black uppercase text-center"
            style={{
              letterSpacing: '0.35em',
              textShadow: '0 0 12px rgba(167,139,250,0.6), 0 0 28px rgba(167,139,250,0.25)',
            }}
          >
            Choose your character
          </p>

          <div
            className="relative w-full overflow-hidden select-none"
            style={{ height: '180px' }}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            {PLAYER_SPRITES.map((sprite, i) => {
              let offset = i - selectedIndex
              if (offset > N / 2) offset -= N
              if (offset < -N / 2) offset += N
              const abs = Math.abs(offset)
              const visible = abs <= 1
              const isCenter = offset === 0
              const xPx = offset * 130
              const scale = isCenter ? 1 : 0.6
              return (
                <div
                  key={sprite}
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    width: '150px',
                    height: '150px',
                    marginLeft: '-75px',
                    marginTop: '-75px',
                    transform: `translateX(${xPx}px) scale(${scale})`,
                    opacity: !visible ? 0 : isCenter ? 1 : 0.35,
                    transition: 'transform 350ms cubic-bezier(0.22, 1, 0.36, 1), opacity 350ms ease',
                    pointerEvents: 'none',
                    zIndex: isCenter ? 2 : 1,
                  }}
                >
                  <div
                    className="w-full h-full flex items-center justify-center rounded-2xl border-2"
                    style={{
                      background: '#111',
                      borderColor: isCenter ? '#ef4444' : 'rgba(255,255,255,0.08)',
                      boxShadow: isCenter ? '0 0 24px rgba(239,68,68,0.45)' : 'none',
                    }}
                  >
                    <img
                      src={`/sprites/${sprite}.png`}
                      alt={sprite}
                      className="w-full h-full object-contain p-3"
                      style={{ mixBlendMode: 'screen' }}
                    />
                  </div>
                </div>
              )
            })}

            <button
              onClick={() => go(-1)}
              aria-label="Previous character"
              className="absolute left-1 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center text-white text-xl font-bold border border-white/10 transition-all active:scale-95 z-10"
              style={{ background: 'rgba(26,26,46,0.85)' }}
            >
              ‹
            </button>
            <button
              onClick={() => go(1)}
              aria-label="Next character"
              className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center text-white text-xl font-bold border border-white/10 transition-all active:scale-95 z-10"
              style={{ background: 'rgba(26,26,46,0.85)' }}
            >
              ›
            </button>
          </div>

          <p className="text-white font-black text-base tracking-widest uppercase">
            {spriteName(selectedSprite)}
          </p>
        </div>

        {/* Home actions */}
        {mode === 'home' && (
          <div className="w-full flex flex-col gap-3">
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            <button
              onClick={() => createGame(false)}
              disabled={!selectedSprite || loading}
              className="w-full py-4 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-bold text-lg tracking-wider uppercase transition-all active:scale-95 shadow-lg shadow-red-900/50"
            >
              {loading ? 'Creating...' : 'Create Game'}
            </button>
            <button
              onClick={() => { setMode('join'); setError('') }}
              disabled={!selectedSprite}
              className="w-full py-4 rounded-xl bg-[#1a1a2e] hover:bg-[#22223b] disabled:opacity-40 border border-white/10 text-white font-bold text-lg tracking-wider uppercase transition-all active:scale-95"
            >
              Join Game
            </button>
            {process.env.NEXT_PUBLIC_ENABLE_TEST_MODE === 'true' && (
              <button
                onClick={() => createGame(true)}
                disabled={!selectedSprite || loading}
                className="w-full py-3 rounded-xl bg-purple-900/40 hover:bg-purple-900/60 disabled:opacity-40 border border-purple-500/40 text-purple-200 font-bold text-sm tracking-wider uppercase transition-all active:scale-95"
              >
                {loading ? 'Creating...' : '🧪 Test Game'}
              </button>
            )}
          </div>
        )}

        {/* Join mode */}
        {mode === 'join' && (
          <div className="w-full flex flex-col gap-3">
            <input
              type="text"
              placeholder="Game code (e.g. ABCD)"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && joinGame()}
              maxLength={getConfig().gameCodeLength}
              className="w-full px-4 py-3 rounded-xl bg-[#1a1a2e] border border-white/10 text-white placeholder-violet-400/40 text-lg font-mono tracking-widest uppercase focus:outline-none focus:border-red-500/50"
            />
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            <button
              onClick={joinGame}
              disabled={loading || !code.trim()}
              className="w-full py-4 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold text-lg tracking-wider uppercase transition-all active:scale-95 shadow-lg shadow-red-900/50"
            >
              {loading ? 'Joining...' : 'Join Game'}
            </button>
            <button
              onClick={() => { setMode('home'); setError('') }}
              className="text-violet-400/70 hover:text-violet-200 text-sm uppercase tracking-wider transition-colors"
            >
              ← Back
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
