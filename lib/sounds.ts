let ctx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

export function unlockAudio() {
  try {
    const c = getCtx()
    const buf = c.createBuffer(1, 1, 22050)
    const src = c.createBufferSource()
    src.buffer = buf
    src.connect(c.destination)
    src.start(0)
  } catch {}
}

function tone(freq: number, type: OscillatorType, start: number, duration: number, volume = 0.3) {
  const c = getCtx()
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  gain.gain.setValueAtTime(volume, start)
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration)
  osc.connect(gain)
  gain.connect(c.destination)
  osc.start(start)
  osc.stop(start + duration)
}

export function playEmergencyMeeting() {
  try {
    if ('vibrate' in navigator) navigator.vibrate([300, 100, 300, 100, 300, 100, 300])
    const c = getCtx()
    const now = c.currentTime
    for (let g = 0; g < 4; g++) {
      for (let i = 0; i < 3; i++) {
        tone(880, 'square', now + g * 0.65 + i * 0.18, 0.12, 0.35)
      }
    }
  } catch {}
}

export function playBodyReport() {
  try {
    if ('vibrate' in navigator) navigator.vibrate([150, 80, 400])
    const c = getCtx()
    const now = c.currentTime
    tone(220, 'sine', now, 0.3, 0.4)
    tone(180, 'sine', now + 0.3, 0.5, 0.35)
    tone(440, 'sine', now + 0.7, 0.25, 0.3)
    tone(330, 'sine', now + 0.95, 0.5, 0.25)
  } catch {}
}

export function playSabotage() {
  try {
    if ('vibrate' in navigator) navigator.vibrate([200, 80, 200, 80, 200, 80, 300])
    const c = getCtx()
    const now = c.currentTime
    for (let i = 0; i < 6; i++) {
      const osc = c.createOscillator()
      const gain = c.createGain()
      osc.type = 'sawtooth'
      const t = now + i * 0.28
      osc.frequency.setValueAtTime(380, t)
      osc.frequency.linearRampToValueAtTime(620, t + 0.14)
      osc.frequency.linearRampToValueAtTime(380, t + 0.28)
      gain.gain.setValueAtTime(0.25, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28)
      osc.connect(gain)
      gain.connect(c.destination)
      osc.start(t)
      osc.stop(t + 0.28)
    }
  } catch {}
}

export function playKill() {
  try {
    if ('vibrate' in navigator) navigator.vibrate([80, 40, 150])
    const c = getCtx()
    const now = c.currentTime
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(500, now)
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.35)
    gain.gain.setValueAtTime(0.45, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35)
    osc.connect(gain)
    gain.connect(c.destination)
    osc.start(now)
    osc.stop(now + 0.35)
  } catch {}
}
