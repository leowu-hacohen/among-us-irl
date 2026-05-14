export interface TaskTemplate {
  name: string
  location: string
  description: string
}

export const TASK_POOL: TaskTemplate[] = [
  { name: 'Fix Wiring', location: 'Electrical Room', description: 'Find the electrical panel and hold the button for 3 seconds.' },
  { name: 'Scan ID Card', location: 'Admin Office', description: 'Scan the QR code posted on the admin desk.' },
  { name: 'Empty Trash', location: 'Cafeteria', description: 'Find the trash bin and scan the QR code on it.' },
  { name: 'Calibrate Navigation', location: 'Navigation Room', description: 'Swipe left-right-left on the panel when prompted.' },
  { name: 'Submit Scan', location: 'MedBay', description: 'Scan the QR code inside MedBay to complete your health scan.' },
  { name: 'Download Data', location: 'Communications', description: 'Hold the download button for 5 seconds at the comms terminal.' },
  { name: 'Fuel Engines', location: 'Engine Room', description: 'Scan both QR codes — one on each engine panel.' },
  { name: 'Inspect Shields', location: 'Shields Room', description: 'Tap each shield icon in order as shown.' },
]

export function assignTasks(taskCount: number): TaskTemplate[] {
  const shuffled = [...TASK_POOL].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, taskCount)
}
