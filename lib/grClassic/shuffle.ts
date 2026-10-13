export function shuffle<T>(items: T[]): T[] {
  const a = items.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Shuffle, but never hand back the answer already in order (when that's possible).
export function shuffleAwayFrom<T>(items: T[]): T[] {
  if (new Set(items).size < 2) return items.slice()
  for (let i = 0; i < 20; i++) {
    const s = shuffle(items)
    if (s.some((x, k) => x !== items[k])) return s
  }
  return items.slice().reverse()
}
