export const PLAYER_SPRITES = [
  'andy', 'arvin', 'bigevan', 'cam', 'evan', 'jerel',
  'juan', 'justin', 'leo', 'ronak', 'sanskar', 'tristan',
]

export function spriteName(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function pickBotSprite(taken: string[]): string {
  const free = PLAYER_SPRITES.filter(s => !taken.includes(s))
  const pool = free.length > 0 ? free : PLAYER_SPRITES
  return pool[Math.floor(Math.random() * pool.length)]
}
