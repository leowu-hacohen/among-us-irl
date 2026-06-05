'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { completeTask } from '@/lib/gameActions'
import type { Task } from '@/types/game'

interface Props {
  gameId: string
  playerId: string
  isAlive: boolean
}

export default function TaskChecklist({ gameId, playerId, isAlive }: Props) {
  const [myTasks, setMyTasks] = useState<Task[]>([])
  const [totalCrewTasks, setTotalCrewTasks] = useState(0)
  const [doneCrewTasks, setDoneCrewTasks] = useState(0)
  const [loading, setLoading] = useState(true)
  const [confirmingTaskId, setConfirmingTaskId] = useState<string | null>(null)

  async function fetchTasks() {
    const [{ data: mine }, { data: all }, { data: players }] = await Promise.all([
      supabase.from('tasks').select().eq('game_id', gameId).eq('player_id', playerId).order('task_order'),
      supabase.from('tasks').select().eq('game_id', gameId),
      supabase.from('players').select('id, role').eq('game_id', gameId),
    ])

    if (mine) setMyTasks(mine as Task[])

    if (all && players) {
      const crewIds = new Set(
        players.filter(p => p.role === 'crewmate').map(p => p.id)
      )
      const crewTasks = (all as Task[]).filter(t => crewIds.has(t.player_id))
      const total = crewTasks.length
      const done = crewTasks.filter(t => t.is_complete).length
      setTotalCrewTasks(total)
      setDoneCrewTasks(done)

      if (total > 0 && done === total) {
        await supabase.from('games')
          .update({ game_over: true, winning_team: 'crewmates' })
          .eq('id', gameId)
          .eq('game_over', false)
      }
    }
  }

  useEffect(() => {
    fetchTasks().finally(() => setLoading(false))

    const channel = supabase
      .channel(`tasks-${gameId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `game_id=eq.${gameId}` }, () => {
        fetchTasks()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId])

  const pct = totalCrewTasks === 0 ? 0 : Math.round((doneCrewTasks / totalCrewTasks) * 100)
  const myDone = myTasks.filter(t => t.is_complete).length
  const current = myTasks.find(t => !t.is_complete) ?? null
  const allDone = myTasks.length > 0 && !current

  if (loading) {
    return <div className="px-4 py-4 text-center text-gray-400 animate-pulse text-sm">Loading tasks...</div>
  }

  return (
    <div className="flex flex-col gap-3 px-3 py-3">
      {/* Progress bar — counts all crew tasks, unchanged */}
      <div>
        <div className="flex justify-between text-[10px] text-gray-400 mb-1 uppercase tracking-wider">
          <span>Crew Progress</span>
          <span>{pct}% complete</span>
        </div>
        <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full rounded-full bg-green-500 transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Personal progress */}
      <div className="flex justify-between items-baseline text-[10px] uppercase tracking-wider text-gray-400">
        <span>Your Task</span>
        <span>
          {allDone ? 'All Done' : `${myDone + 1} of ${myTasks.length}`}
        </span>
      </div>

      {allDone ? (
        <div className="rounded-xl p-4 border border-green-700/40 bg-green-900/20 text-center">
          <p className="text-green-400 font-black text-sm uppercase tracking-widest">✓ All tasks complete</p>
        </div>
      ) : current ? (
        <button
          onClick={() => isAlive && setConfirmingTaskId(current.id)}
          disabled={!isAlive}
          className={`rounded-xl p-4 border text-left flex items-start gap-3 transition-all active:scale-[0.98] w-full ${
            !isAlive
              ? 'bg-white/5 border-white/5 opacity-40'
              : 'bg-[#1a1a2e] border-white/10 active:bg-[#22223b]'
          }`}
        >
          <div className="flex-shrink-0 mt-0.5">
            <div className="w-5 h-5 rounded-full border-2 border-white/30" />
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <p className="font-bold text-base leading-tight text-white">
              {current.emoji} {current.name}
            </p>
            <p className="text-xs leading-snug text-gray-400">
              {current.description}
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-widest text-gray-500">Tap when done</p>
          </div>
        </button>
      ) : null}

      {confirmingTaskId && current && confirmingTaskId === current.id && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 px-6">
          <div className="bg-[#1a1a2e] rounded-2xl p-6 w-full max-w-sm border border-white/10 text-center flex flex-col gap-4">
            <p className="text-4xl">{current.emoji}</p>
            <p className="text-white font-bold text-lg">Finished &quot;{current.name}&quot;?</p>
            <p className="text-gray-400 text-sm">You can&apos;t undo this.</p>
            <button onClick={() => { const id = confirmingTaskId; setConfirmingTaskId(null); completeTask(id) }}
              className="w-full py-4 rounded-xl font-black text-lg uppercase tracking-wider active:scale-95"
              style={{ background: 'linear-gradient(to bottom, #16a34a, #15803d)', color: '#fff' }}>
              Yes — Mark Complete
            </button>
            <button onClick={() => setConfirmingTaskId(null)}
              className="w-full py-3 text-gray-400 hover:text-white text-sm uppercase tracking-wider">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
