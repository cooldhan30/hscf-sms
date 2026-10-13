import 'server-only'
import { notFound } from 'next/navigation'
import { gameById } from '../sampleData'
import { isUuid } from '../validateQuestion'
import type { Game } from '../types'
import { grcTeacherPage } from './auth'
import { categoryNames, getGame, listCategories } from './db'

// A game for a teacher page: a saved game (uuid id) must belong to the
// signed-in teacher; the Phase 1 sample games (e.g. g-uyir-quiz) still
// open so the not-yet-built screens keep working with sample data.
export async function loadTeacherGame(path: string, id: string): Promise<{ ok: true; game: Game } | { ok: false; error: string }> {
  if (!isUuid(id)) {
    const sample = gameById(id)
    if (!sample) notFound()
    return { ok: true, game: sample }
  }
  const t = await grcTeacherPage(path)
  if (!t.ok) return t
  const game = await getGame(t.supabase, id, categoryNames(await listCategories(t.supabase, t.userId)))
  if (!game) notFound()
  return { ok: true, game }
}
