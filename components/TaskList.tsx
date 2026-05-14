'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Task } from '@/types/game'

interface Props {
  tasks: Task[]
  allTasks: Task[]  // all tasks in the game for progress bar
  onTaskComplete: (taskId: string) => void
  isDead?: boolean
}

export default function TaskList({ tasks, allTasks, onTaskComplete, isDead = false }: Props) {
  const [completing, setCompleting] = useState<string | null>(null)

  const completedCount = allTasks.filter(t => t.is_complete).length
  const totalCount = allTasks.length
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  async function completeTask(taskId: string) {
    if (isDead || completing) return
    setCompleting(taskId)
    await supabase.from('tasks').update({ is_complete: true }).eq('id', taskId)
    onTaskComplete(taskId)
    setCompleting(null)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Overall progress bar */}
      <div>
        <div className="flex justify-between mb-1">
          <span className="text-xs text-gray-400 uppercase tracking-wider">Task Progress</span>
          <span className="text-xs text-green-400 font-bold">{completedCount}/{totalCount}</span>
        </div>
        <div className="w-full bg-[#1a1a2e] rounded-full h-3 border border-white/5">
          <div
            className="bg-green-500 h-3 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Task list */}
      <div className="flex flex-col gap-3">
        {tasks.map(task => (
          <div
            key={task.id}
            className={`rounded-xl p-4 border transition-all ${
              task.is_complete
                ? 'bg-[#0f1f0f] border-green-800/50 opacity-60'
                : 'bg-[#1a1a2e] border-white/10'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-base font-bold ${task.is_complete ? 'text-green-400 line-through' : 'text-white'}`}>
                    {task.name}
                  </span>
                  {task.is_complete && <span className="text-green-400 text-sm">✓</span>}
                </div>
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">
                  📍 {task.location}
                </p>
                <p className="text-sm text-gray-300">{task.description}</p>
              </div>
              {!task.is_complete && !isDead && (
                <button
                  onClick={() => completeTask(task.id)}
                  disabled={completing === task.id}
                  className="flex-shrink-0 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold text-sm uppercase tracking-wider transition-all active:scale-95"
                >
                  {completing === task.id ? '...' : 'Done'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
