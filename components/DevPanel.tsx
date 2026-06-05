'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { completeTask, killPlayer, callMeeting, triggerReactor, completeReactorStation } from '@/lib/gameActions'
import { getConfig } from '@/lib/gameConfig'
import type { Game, Player, Task } from '@/types/game'

interface Props {
  game: Game
  player: Player
}

interface DevAction {
  label: string
  group: 'role' | 'tasks' | 'kill' | 'meeting' | 'reactor'
  run: () => Promise<void>
}

export default function DevPanel({ game, player }: Props) {
  const [open, setOpen] = useState(false)
  const [players, setPlayers] = useState<Player[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  async function refresh() {
    const [{ data: pls }, { data: ts }] = await Promise.all([
      supabase.from('players').select().eq('game_id', game.id),
      supabase.from('tasks').select().eq('game_id', game.id),
    ])
    if (pls) setPlayers(pls as Player[])
    if (ts) setTasks(ts as Task[])
  }

  useEffect(() => { if (open) refresh() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open])

  function buildActions(): DevAction[] {
    const actions: DevAction[] = []

    actions.push({
      label: 'Make me impostor',
      group: 'role',
      run: async () => { await supabase.from('players').update({ role: 'impostor' }).eq('id', player.id) },
    })
    actions.push({
      label: 'Make me crewmate',
      group: 'role',
      run: async () => { await supabase.from('players').update({ role: 'crewmate' }).eq('id', player.id) },
    })

    const myTasks = tasks.filter(t => t.player_id === player.id && !t.is_complete)
    actions.push({
      label: `Complete all my tasks (${myTasks.length})`,
      group: 'tasks',
      run: async () => { await Promise.all(myTasks.map(t => completeTask(t.id))) },
    })

    const botIds = new Set(players.filter(p => p.is_bot).map(p => p.id))
    const botTasks = tasks.filter(t => botIds.has(t.player_id) && !t.is_complete)
    actions.push({
      label: `Complete all bot tasks (${botTasks.length})`,
      group: 'tasks',
      run: async () => { await Promise.all(botTasks.map(t => completeTask(t.id))) },
    })

    const allOpen = tasks.filter(t => !t.is_complete)
    actions.push({
      label: `Complete ALL tasks (${allOpen.length})`,
      group: 'tasks',
      run: async () => { await Promise.all(allOpen.map(t => completeTask(t.id))) },
    })

    for (const p of players.filter(p => p.is_alive)) {
      actions.push({
        label: `Kill ${p.name}${p.is_bot ? ' [bot]' : ''}${p.id === player.id ? ' (me)' : ''}`,
        group: 'kill',
        run: async () => { await killPlayer(game.id, p.id) },
      })
    }

    for (const p of players.filter(p => p.is_bot && p.is_alive)) {
      actions.push({
        label: `Call meeting as ${p.name}`,
        group: 'meeting',
        run: async () => { await callMeeting({ gameId: game.id, callerId: p.id, type: 'emergency' }) },
      })
    }

    const sabotageActive = game.current_sabotage === 'reactor'
    const cooling = !!game.reactor_cooldown_until && new Date(game.reactor_cooldown_until) > new Date()

    if (!sabotageActive) {
      actions.push({
        label: cooling ? 'Trigger reactor (cooldown active — will no-op)' : 'Trigger reactor',
        group: 'reactor',
        run: async () => { await triggerReactor(game.id) },
      })
    }

    if (sabotageActive) {
      actions.push({
        label: 'Fast-forward reactor to 5s left',
        group: 'reactor',
        run: async () => {
          const duration = getConfig(game).reactorDurationSeconds
          const startedAt = new Date(Date.now() - (duration - 5) * 1000).toISOString()
          await supabase.from('games').update({ reactor_started_at: startedAt }).eq('id', game.id)
        },
      })
      if (!game.reactor_station_a_complete) {
        actions.push({
          label: 'Complete station A',
          group: 'reactor',
          run: async () => { await completeReactorStation(game.id, 'A') },
        })
      }
      if (!game.reactor_station_b_complete) {
        actions.push({
          label: 'Complete station B',
          group: 'reactor',
          run: async () => { await completeReactorStation(game.id, 'B') },
        })
      }
    }

    if (cooling) {
      actions.push({
        label: 'Clear reactor cooldown',
        group: 'reactor',
        run: async () => {
          await supabase.from('games').update({ reactor_cooldown_until: new Date(0).toISOString() }).eq('id', game.id)
        },
      })
    }

    return actions
  }

  async function runAction(action: DevAction) {
    if (busy) return
    setBusy(action.label)
    try { await action.run() } finally {
      setBusy(null)
      await refresh()
    }
  }

  const actions = buildActions()
  const groups: { key: DevAction['group']; title: string }[] = [
    { key: 'role', title: 'Role' },
    { key: 'tasks', title: 'Tasks' },
    { key: 'reactor', title: 'Reactor' },
    { key: 'kill', title: 'Kill' },
    { key: 'meeting', title: 'Meetings' },
  ]

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-44 right-4 z-[55] w-12 h-12 rounded-full bg-purple-700 hover:bg-purple-600 border-2 border-purple-300/50 text-white font-black text-lg shadow-lg shadow-purple-900/50 active:scale-95"
        title="Dev panel (test mode)"
      >
        🧪
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70" onClick={() => setOpen(false)}>
          <div className="bg-[#1a1a2e] rounded-t-3xl p-5 w-full border-t border-purple-500/40 flex flex-col gap-3"
            style={{ maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="text-purple-300 font-black uppercase tracking-widest text-sm">🧪 Dev Panel</p>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white text-sm uppercase tracking-wider">Close</button>
            </div>

            <div className="overflow-y-auto flex flex-col gap-4">
              {groups.map(g => {
                const items = actions.filter(a => a.group === g.key)
                if (items.length === 0) return null
                return (
                  <div key={g.key} className="flex flex-col gap-1.5">
                    <p className="text-gray-500 text-[10px] uppercase tracking-widest font-bold">{g.title}</p>
                    {items.map(a => (
                      <button
                        key={a.label}
                        onClick={() => runAction(a)}
                        disabled={busy !== null}
                        className="w-full px-3 py-2.5 rounded-lg text-left text-sm font-bold border border-purple-500/30 bg-purple-950/30 hover:bg-purple-900/40 text-purple-100 disabled:opacity-40 transition-all active:scale-[0.98]"
                      >
                        {busy === a.label ? '…' : a.label}
                      </button>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
