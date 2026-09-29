// Sort the Baskets: CATEGORIZE questions. The items and the categories
// (baskets) come from /state; the child's whole sorting goes to /answer
// as { item: category } and is graded there, all or nothing.

import type { KidsQuestion } from './choices'

export interface SortItem {
  key: string
  label: string
}

export function sortItems(q: KidsQuestion): SortItem[] {
  return ((q.payload?.items as string[]) ?? []).map((label, i) => ({ key: `s${i}`, label }))
}

export function sortCategories(q: KidsQuestion): string[] {
  return (q.payload?.categories as string[]) ?? []
}

// After a wrong sort, /answer reveals the right one as "item: basket, ..."
// (lib/gameRoomV2/answerReveal.ts). Read it back into item key -> basket
// index; null if it doesn't fit this question's items and baskets.
export function revealedSorting(revealed: string | null, items: SortItem[], categories: string[]): Record<string, number> | null {
  if (!revealed) return null
  const out: Record<string, number> = {}
  for (const pair of revealed.split(', ')) {
    const cut = pair.lastIndexOf(': ')
    if (cut === -1) return null
    const item = items.find((it) => it.label === pair.slice(0, cut) && out[it.key] === undefined)
    const basket = categories.indexOf(pair.slice(cut + 2))
    if (!item || basket === -1) return null
    out[item.key] = basket
  }
  return Object.keys(out).length === items.length ? out : null
}
