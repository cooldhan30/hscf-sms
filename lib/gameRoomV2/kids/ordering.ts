// Letter Parade: ORDER_LETTERS / ORDER_WORDS questions. The scrambled
// tiles come from /state; the child puts them on the caterpillar in order
// and the whole order goes to /answer (graded there).

import type { KidsQuestion } from './choices'

export const ORDER_QUESTION_TYPES = ['ORDER_LETTERS', 'ORDER_WORDS'] as const

export interface OrderTile {
  key: string
  label: string
}

export function orderTiles(q: KidsQuestion): OrderTile[] {
  const p = q.payload ?? {}
  const items = q.questionType === 'ORDER_WORDS' ? ((p.words as string[]) ?? []) : ((p.letters as string[]) ?? [])
  return items.map((label, i) => ({ key: `t${i}`, label }))
}

// After a wrong order, /answer reveals the right one as one string --
// letters joined with nothing ("அஆஇஈ"), words joined with spaces. Split it
// back into this question's own tiles (longest tile first, so "க்" isn't
// read as "க" + a stray virama). Returns tile keys in the right order,
// or null if the string doesn't fit the tiles.
export function revealedOrder(revealed: string | null, tiles: OrderTile[], questionType: string): string[] | null {
  if (!revealed) return null
  const unused = [...tiles]
  const take = (label: string) => {
    const i = unused.findIndex((t) => t.label === label)
    return i === -1 ? null : unused.splice(i, 1)[0].key
  }
  const keys: string[] = []
  if (questionType === 'ORDER_WORDS') {
    for (const word of revealed.split(' ').filter(Boolean)) {
      const k = take(word)
      if (!k) return null
      keys.push(k)
    }
  } else {
    let rest = revealed
    while (rest.length > 0) {
      const match = unused
        .filter((t) => t.label.length > 0 && rest.startsWith(t.label))
        .sort((a, b) => b.label.length - a.label.length)[0]
      if (!match) return null
      keys.push(take(match.label)!)
      rest = rest.slice(match.label.length)
    }
  }
  return keys.length === tiles.length ? keys : null
}
