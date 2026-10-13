import 'server-only'
import { notFound } from 'next/navigation'
import { isUuid } from '../validateQuestion'
import type { Game } from '../types'
import { grcTeacherPage } from './auth'
import { categoryNames, getGame, listCategories } from './db'

// A saved game for a teacher page; it must belong to the signed-in teacher.
export async function loadTeacherGame(path: string, id: string): Promise<{ ok: true; game: Game } | { ok: false; error: string }> {
  if (!isUuid(id)) notFound()
  const t = await grcTeacherPage(path)
  if (!t.ok) return t
  const game = await getGame(t.supabase, id, categoryNames(await listCategories(t.supabase, t.userId)))
  if (!game) notFound()
  return { ok: true, game }
}
