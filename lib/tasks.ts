export interface TaskTemplate {
  name: string
  emoji: string
  description: string
}

export const TASK_POOL: TaskTemplate[] = [
  { name: 'Basketball', emoji: '🏀', description: 'Make 2 shots in a row from the marked distance.' },
  { name: 'Whiteboard', emoji: '📝', description: 'Draw the assigned prompt on the whiteboard, like a portrait or perfect circle.' },
{ name: 'Scale', emoji: '⚖️', description: 'Use books/items to make the scale read exactly 200 lbs. (±0.5)' },
  { name: 'Restock Supplies', emoji: '🧻', description: 'Bring 2 paper towels from the bathroom to the kitchen.' },
  { name: 'Stopwatch', emoji: '⏱️', description: 'Stop the stopwatch at exactly 10 seconds. (±0.5)' },
  { name: 'Cup Ball', emoji: '🎯', description: 'Roll the ball across the table into the red cup taped at the end.' },
  { name: "Rubik's Cube", emoji: '🧩', description: "Solve one full side of the Rubik's Cube." },
]

export function assignTasks(taskCount: number): TaskTemplate[] {
  const shuffled = [...TASK_POOL].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, taskCount)
}
