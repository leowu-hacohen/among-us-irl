'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function generateCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let code = ''
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

const PLAYER_COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'cyan', 'lime', 'maroon']

export default function Home() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [mode, setMode] = useState<'home' | 'create' | 'join'>('home')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function createGame() {
    if (!name.trim()) { setError('Please enter your name'); return }
    setLoading(true)
    setError('')
    const gameCode = generateCode()
    const randomColor = PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)]
    const { data: game, error: gameError } = await supabase
      .from('games')
      .insert({ code: gameCode, status: 'lobby', task_count: 3 })
      .select()
      .single()
    if (gameError || !game) { setError('Failed to create game'); setLoading(false); return }
    const { data: player, error: playerError } = await supabase
      .from('players')
      .insert({ game_id: game.id, name: name.trim(), color: randomColor })
      .select()
      .single()
    if (playerError || !player) { setError('Failed to create player'); setLoading(false); return }
    await supabase.from('games').update({ host_id: player.id }).eq('id', game.id)
    localStorage.setItem('playerId', player.id)
    localStorage.setItem('gameCode', gameCode)
    router.push(`/lobby/${gameCode}`)
  }

  async function joinGame() {
    if (!name.trim()) { setError('Please enter your name'); return }
    if (!code.trim()) { setError('Please enter a game code'); return }
    setLoading(true)
    setError('')
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select()
      .eq('code', code.toUpperCase())
      .single()
    if (gameError || !game) { setError('Game not found'); setLoading(false); return }
    if (game.status !== 'lobby') { setError('Game already started'); setLoading(false); return }
    const randomColor = PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)]
    const { data: player, error: playerError } = await supabase
      .from('players')
      .insert({ game_id: game.id, name: name.trim(), color: randomColor })
      .select()
      .single()
    if (playerError || !player) { setError('Failed to join'); setLoading(false); return }
    localStorage.setItem('playerId', player.id)
    localStorage.setItem('gameCode', code.toUpperCase())
    router.push(`/lobby/${code.toUpperCase()}`)
  }

  return (
    <div className="min-h-screen bg-[#0d0d1a] flex flex-col items-center justify-center px-6 py-12">
      {/* Stars background effect */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {[...Array(50)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white opacity-30"
            style={{
              width: Math.random() * 2 + 1 + 'px',
              height: Math.random() * 2 + 1 + 'px',
              top: Math.random() * 100 + '%',
              left: Math.random() * 100 + '%',
            }}
          />
        ))}
      </div>

      <div className="relative z-10 w-full max-w-sm flex flex-col items-center gap-8">
        {/* Title */}
        <div className="text-center">
          <h1
            className="text-5xl font-black tracking-widest uppercase"
            style={{
              color: '#ef4444',
              textShadow: '0 0 20px rgba(239,68,68,0.8), 0 0 40px rgba(239,68,68,0.4)',
            }}
          >
            AMONG
          </h1>
          <h1
            className="text-5xl font-black tracking-widest uppercase"
            style={{
              color: 'white',
              textShadow: '0 0 20px rgba(255,255,255,0.4)',
            }}
          >
            US IRL
          </h1>
          <p className="mt-2 text-gray-400 text-sm tracking-widest uppercase">Find the impostor</p>
        </div>

        {/* Home buttons */}
        {mode === 'home' && (
          <div className="w-full flex flex-col gap-4">
            <button
              onClick={() => setMode('create')}
              className="w-full py-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-lg tracking-wider uppercase transition-all active:scale-95 shadow-lg shadow-red-900/50"
            >
              Create Game
            </button>
            <button
              onClick={() => setMode('join')}
              className="w-full py-4 rounded-xl bg-[#1a1a2e] hover:bg-[#22223b] border border-white/10 text-white font-bold text-lg tracking-wider uppercase transition-all active:scale-95"
            >
              Join Game
            </button>
          </div>
        )}

        {/* Create Game Form */}
        {mode === 'create' && (
          <div className="w-full flex flex-col gap-4">
            <h2 className="text-xl font-bold text-center text-white/80 uppercase tracking-wider">Create Game</h2>
            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createGame()}
              maxLength={16}
              className="w-full px-4 py-3 rounded-xl bg-[#1a1a2e] border border-white/10 text-white placeholder-gray-500 text-lg focus:outline-none focus:border-red-500/50"
            />
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            <button
              onClick={createGame}
              disabled={loading}
              className="w-full py-4 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold text-lg tracking-wider uppercase transition-all active:scale-95 shadow-lg shadow-red-900/50"
            >
              {loading ? 'Creating...' : 'Create Game'}
            </button>
            <button
              onClick={() => { setMode('home'); setError('') }}
              className="text-gray-400 hover:text-white text-sm uppercase tracking-wider transition-colors"
            >
              ← Back
            </button>
          </div>
        )}

        {/* Join Game Form */}
        {mode === 'join' && (
          <div className="w-full flex flex-col gap-4">
            <h2 className="text-xl font-bold text-center text-white/80 uppercase tracking-wider">Join Game</h2>
            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={16}
              className="w-full px-4 py-3 rounded-xl bg-[#1a1a2e] border border-white/10 text-white placeholder-gray-500 text-lg focus:outline-none focus:border-red-500/50"
            />
            <input
              type="text"
              placeholder="Game code (e.g. ABCD)"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && joinGame()}
              maxLength={4}
              className="w-full px-4 py-3 rounded-xl bg-[#1a1a2e] border border-white/10 text-white placeholder-gray-500 text-lg font-mono tracking-widest uppercase focus:outline-none focus:border-red-500/50"
            />
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            <button
              onClick={joinGame}
              disabled={loading}
              className="w-full py-4 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold text-lg tracking-wider uppercase transition-all active:scale-95 shadow-lg shadow-red-900/50"
            >
              {loading ? 'Joining...' : 'Join Game'}
            </button>
            <button
              onClick={() => { setMode('home'); setError('') }}
              className="text-gray-400 hover:text-white text-sm uppercase tracking-wider transition-colors"
            >
              ← Back
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
