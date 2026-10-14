'use client'

import type { GameType, QuestionKind } from '@/lib/grClassic/types'

// "Make a game with these questions": the Question Library hands the
// questions it is showing to Create Game through sessionStorage (the ids
// can be too many for a URL). The game type also travels in the URL
// (?type=), so the right type opens even if storage is unavailable.

const KEY = 'grc-new-game-pick'

export const GAME_FOR_KIND: Record<QuestionKind, GameType> = { choice: 'quiz', match: 'match', order: 'word-builder' }

export interface Pick {
  type: GameType
  ids: string[]
}

export function savePick(pick: Pick) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ type: pick.type, ids: pick.ids.slice(0, 100) }))
  } catch {
    // Storage blocked (private mode): Create Game still opens on the right type.
  }
}

// Read without removing (React may run an initializer twice); clearPick()
// afterwards so a later visit to Create Game starts empty.
export function peekPick(): Pick | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    const v = raw ? (JSON.parse(raw) as Pick) : null
    return v && Array.isArray(v.ids) ? v : null
  } catch {
    return null
  }
}

export function clearPick() {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // nothing to clear
  }
}
