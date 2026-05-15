'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Task } from '@/types/game'

interface Props {
  gameId: string
  playerId: string
}

export default function TaskChecklist({ gameId, playerId }: Props) {
  const [myTasks, setMyTasks] = useState<Task[]>([])
  const [allTasks, setAllTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchTasks() {
    const { data: mine } = await supabase.from('tasks').select().eq('game_id', gameId).eq('player_id', playerId).order('name')
    const { data: all } = await supabase.from('tasks').select().eq('game_id', gameId)
    if (mine) setMyTasks(mine as Task[])
    if (all) {
      setAllTasks(all as Task[])

      // Check crewmates win: all non-reactor tasks complete
      const { data: players } = await supabase.from('players').select('id, role').eq('game_id', gameId)
      if (players) {
        const reactorIds = new Set(
          players.filter(p => p.role === 'reactor_1' || p.role === 'reactor_2').map(p => p.id)
        )
        const crewTasks = all.filter(t => !reactorIds.has(t.player_id))
        const total = crewTasks.length
        const done = crewTasks.filter(t => t.is_complete).length
        if (total > 0 && done === total) {
          await supabase.from('games')
            .update({ game_over: true, winning_team: 'crewmates' })
            .eq('id', gameId)
            .eq('game_over', false)
        }
      }
    }
  }

  useEffect(() => {
    fetchTasks().finally(() => setLoading(false))

    const channel = supabase
      .channel(`tasks-${gameId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tasks',
        filter: `game_id=eq.${gameId}`,
      }, () => {
        fetchTasks()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId])

  async function completeTask(taskId: string) {
    await supabase.from('tasks').update({ is_complete: true }).eq('id', taskId)
  }

  // Progress counts exclude reactor player tasks
  const [reactorPlayerIds, setReactorPlayerIds] = useState<Set<string>>(new Set())
  useEffect(() => {
    supabase.from('players').select('id, role').eq('game_id', gameId).then(({ data }) => {
      if (data) setReactorPlayerIds(new Set(data.filter(p => p.role === 'reactor_1' || p.role === 'reactor_2').map(p => p.id)))
    })
  }, [gameId])

  const crewTasks = allTasks.filter(t => !reactorPlayerIds.has(t.player_id))
  const total = crewTasks.length
  const done = crewTasks.filter(t => t.is_complete).length
  const pct = total === 0 ? 0 : Math.round((done / total) * 100)

  if (loading) {
    return (
      <div className="px-4 py-6 text-center text-gray-400 animate-pulse text-sm">
        Loading tasks...
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-xs text-gray-400 mb-1 uppercase tracking-wider">
          <span>Tasks</span>
          <span>{pct}% complete</span>
        </div>
        <div className="w-full h-3 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-green-500 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Task grid — 2 columns */}
      <div className="grid grid-cols-2 gap-2">
        {myTasks.map(task => (
          <div
            key={task.id}
            className={`rounded-xl p-3 border flex flex-col gap-1.5 transition-all ${task.is_complete ? 'bg-green-900/30 border-green-700/40' : 'bg-[#1a1a2e] border-white/10'}`}
          >
            <div className="flex items-start gap-2">
              {task.is_complete ? (
                <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-white/30 flex-shrink-0 mt-0.5" />
              )}
              <p className={`font-bold text-xs leading-tight ${task.is_complete ? 'text-green-400 line-through' : 'text-white'}`}>
                {task.name}
              </p>
            </div>
            <p className={`text-xs ${task.is_complete ? 'text-green-600 line-through' : 'text-gray-400'}`}>
              {task.emoji}
            </p>
            <p className={`text-xs leading-tight ${task.is_complete ? 'text-green-700 line-through' : 'text-gray-500'}`}>
              {task.description}
            </p>
            {!task.is_complete && (
              <button
                onClick={() => completeTask(task.id)}
                className="mt-auto w-full py-1.5 rounded-lg bg-green-700 hover:bg-green-600 active:scale-95 text-white text-xs font-bold uppercase tracking-wider transition-all"
              >
                Done
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
