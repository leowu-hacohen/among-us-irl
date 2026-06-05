'use client'
import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ReactorStation from '@/components/ReactorStation'
import type { Game } from '@/types/game'

export default function ReactorRoute() {
  const router = useRouter()
  const params = useParams()
  const search = useSearchParams()
  const code = (params.code as string).toUpperCase()
  const slotParam = (search.get('slot') ?? 'A').toUpperCase()
  const stationSlot: 'reactor_1' | 'reactor_2' = slotParam === 'B' ? 'reactor_2' : 'reactor_1'

  const [game, setGame] = useState<Game | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function init() {
      const { data, error: err } = await supabase.from('games').select().eq('code', code).single()
      if (err || !data) { setError('Game not found'); return }
      setGame(data)
      channel = supabase
        .channel(`reactor-${data.id}`)
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${data.id}`,
        }, (payload) => {
          setGame(prev => prev ? { ...prev, ...(payload.new as Partial<Game>) } : payload.new as Game)
        })
        .subscribe()
    }

    init()
    return () => { if (channel) supabase.removeChannel(channel) }
  }, [code])

  if (error) {
    return (
      <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-red-400 text-xl mb-4">{error}</p>
          <button onClick={() => router.push('/')} className="text-violet-400/70 hover:text-white underline">Go Home</button>
        </div>
      </div>
    )
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center">
        <p className="text-violet-400/70 animate-pulse text-lg">Loading station...</p>
      </div>
    )
  }

  return <ReactorStation game={game} stationSlot={stationSlot} />
}
