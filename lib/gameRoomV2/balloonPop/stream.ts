// Balloon Pop "pop the type" rounds. A CATEGORIZE question (items sorted
// into categories, e.g. உயிரெழுத்து / மெய்யெழுத்து) becomes one round:
// the child is asked to pop every balloon of ONE category while all the
// question's items -- right type and wrong type mixed -- float up from the
// bottom, each item twice. Every pop is checked by the server
// (/sessions/[id]/pop-check); at the end of the round the list of pops
// goes to /answer, which scores it with gradePops() below. Both sides use
// the same rules, so the points on screen are the points that count.

export const BALLOON_POP_ENGINE_ID = 'balloon-pop'

// How many times each item floats up in a round
export const POP_REPEAT = 2
export const POINTS_PER_POP = 10
export const XP_PER_POP = 2

// The category a round asks for. Rotates through the categories by
// question index (round 1: the first category, round 2: the second...),
// so a set of உயிர்/மெய் questions practises both. Known to the client
// from /state (categories are not secret); only which ITEM belongs to it is.
export function popTarget(categories: readonly string[], questionIndex: number): string | null {
  if (!categories.length) return null
  return categories[((questionIndex % categories.length) + categories.length) % categories.length]
}

export interface Pop {
  item: string
  copy: number
}

export interface PopTally {
  correct: number
  wrong: number
  missed: number
  // Balloons of the asked-for type that floated up (items x POP_REPEAT)
  targets: number
}

export interface PopGrade extends PopTally {
  // Every target popped and nothing else: counts as a "correct" answer
  // for streaks and accuracy
  perfect: boolean
  points: number
  xp: number
  coins: number
}

interface CategorizeLike {
  items?: unknown
  categories?: unknown
  answerKey?: unknown
}

// Scores one round from the server-held payload. Pops that don't name a
// real balloon (unknown item, copy out of range, a repeat) are ignored,
// so a client can't earn more than the balloons that actually exist.
export function gradePops(payload: CategorizeLike, questionIndex: number, submitted: unknown): PopGrade {
  const items = Array.isArray(payload.items) ? payload.items.filter((x): x is string => typeof x === 'string') : []
  const categories = Array.isArray(payload.categories) ? payload.categories.filter((x): x is string => typeof x === 'string') : []
  const answerKey = (payload.answerKey && typeof payload.answerKey === 'object' ? payload.answerKey : {}) as Record<string, string>
  const target = popTarget(categories, questionIndex)
  const itemSet = new Set(items)
  const targets = items.filter((i) => answerKey[i] === target).length * POP_REPEAT

  const raw = submitted && typeof submitted === 'object' && Array.isArray((submitted as { popped?: unknown }).popped) ? (submitted as { popped: unknown[] }).popped : []
  const seen = new Set<string>()
  let correct = 0
  let wrong = 0
  for (const p of raw) {
    if (!p || typeof p !== 'object') continue
    const { item, copy } = p as { item?: unknown; copy?: unknown }
    if (typeof item !== 'string' || !itemSet.has(item) || !Number.isInteger(copy) || (copy as number) < 0 || (copy as number) >= POP_REPEAT) continue
    const key = `${item}#${copy}`
    if (seen.has(key)) continue
    seen.add(key)
    if (answerKey[item] === target) correct++
    else wrong++
  }
  const missed = Math.max(0, targets - correct)
  const perfect = targets > 0 && missed === 0 && wrong === 0
  return { correct, wrong, missed, targets, perfect, points: correct * POINTS_PER_POP, xp: correct * XP_PER_POP, coins: perfect ? 2 : 0 }
}

// One pop, checked: is this item of the asked-for type? Also says which
// type it really is, so a wrong pop can teach ("அது மெய்யெழுத்து").
export function checkPop(payload: CategorizeLike, questionIndex: number, item: string): { isTarget: boolean; category: string | null } | null {
  const items = Array.isArray(payload.items) ? payload.items : []
  if (!items.includes(item)) return null
  const categories = Array.isArray(payload.categories) ? payload.categories.filter((x): x is string => typeof x === 'string') : []
  const answerKey = (payload.answerKey && typeof payload.answerKey === 'object' ? payload.answerKey : {}) as Record<string, string>
  const category = typeof answerKey[item] === 'string' ? answerKey[item] : null
  return { isTarget: category !== null && category === popTarget(categories, questionIndex), category }
}

// The order balloons float up in a round: every item POP_REPEAT times,
// shuffled, never the same item twice in a row where avoidable.
export function popStream(items: readonly string[], random: () => number = Math.random): Pop[] {
  const all: Pop[] = items.flatMap((item) => Array.from({ length: POP_REPEAT }, (_, copy) => ({ item, copy })))
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[all[i], all[j]] = [all[j], all[i]]
  }
  for (let i = 1; i < all.length; i++) {
    if (all[i].item !== all[i - 1].item) continue
    const k = all.findIndex((p, j) => j > i && p.item !== all[i].item && (j + 1 >= all.length || all[j + 1]?.item !== all[i].item))
    if (k > -1) [all[i], all[k]] = [all[k], all[i]]
  }
  return all
}
