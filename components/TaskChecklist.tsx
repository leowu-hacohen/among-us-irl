'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Task } from '@/types/game'

interface Props {
  gameId: string
}

export default function TaskChecklist({ gameId }: Props) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchTasks() {
    const { data } = await supabase
      .from('tasks')
      .select()
      .eq('game_id', gameId)
      .order('name')
    if (data) setTasks(data as Task[])
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

  const total = tasks.length
  const done = tasks.filter(t => t.is_complete).length
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
          <span>{done} / {total} complete</span>
        </div>
        <div className="w-full h-3 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-green-500 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Task list */}
      <div className="flex flex-col gap-2">
        {tasks.map(task => (
          <div
            key={task.id}
            className={`rounded-xl p-4 border transition-all ${task.is_complete ? 'bg-green-900/30 border-green-700/40' : 'bg-[#1a1a2e] border-white/10'}`}
          >
            <div className="flex items-start gap-3">
              {/* Checkbox / check icon */}
              <div className="flex-shrink-0 mt-0.5">
                {task.is_complete ? (
                  <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full border-2 border-white/30" />
                )}
              </div>

              {/* Task info */}
              <div className="flex-1 min-w-0">
                <p className={`font-bold text-sm ${task.is_complete ? 'text-green-400 line-through' : 'text-white'}`}>
                  {task.name}
                </p>
                <p className={`text-xs mt-0.5 ${task.is_complete ? 'text-green-600 line-through' : 'text-gray-400'}`}>
                  📍 {task.location}
                </p>
                <p className={`text-xs mt-1 ${task.is_complete ? 'text-green-700 line-through' : 'text-gray-500'}`}>
                  {task.description}
                </p>
              </div>

              {/* Complete button */}
              {!task.is_complete && (
                <button
                  onClick={() => completeTask(task.id)}
                  className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-green-700 hover:bg-green-600 active:scale-95 text-white text-xs font-bold uppercase tracking-wider transition-all"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
