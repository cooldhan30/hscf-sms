import { QuestionLibrary } from '@/components/grClassic/teacher/QuestionLibrary'
import { TeachersOnly } from '@/components/grClassic/TeachersOnly'
import { grcTeacherPage } from '@/lib/grClassic/server/auth'
import { categoryNames, libraryKindCounts, listCategories, searchLibrary } from '@/lib/grClassic/server/db'
import { createAdminClient } from '@/lib/supabase/admin'
import type { QuestionKind } from '@/lib/grClassic/types'

export const dynamic = 'force-dynamic'

// The shared Question Library. Only the first page (newest first) and the
// count of each question type are sent; the page fetches more as the
// teacher filters, searches or scrolls. Read by the server: every teacher
// may read the whole library, and this spares a permission check per row.
export default async function GrClassicLibraryPage() {
  const t = await grcTeacherPage('/gr-classic/teacher/library')
  if (!t.ok) return <TeachersOnly message={t.error} />
  const admin = createAdminClient()
  const [categories, counts] = await Promise.all([listCategories(admin, t.userId), libraryKindCounts(admin)])
  const kind = (['choice', 'match', 'order'] as QuestionKind[]).find((k) => counts[k] > 0) ?? 'choice'
  const first = await searchLibrary(admin, categoryNames(categories), t.userId, { kind, topic: '', mine: false, search: '', offset: 0 })
  return <QuestionLibrary first={{ kind, ...first }} counts={counts} categories={categories} />
}
