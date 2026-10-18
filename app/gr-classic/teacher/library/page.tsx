import { QuestionLibrary } from '@/components/grClassic/teacher/QuestionLibrary'
import { TeachersOnly } from '@/components/grClassic/TeachersOnly'
import { grcTeacherPage } from '@/lib/grClassic/server/auth'
import { categoryNames, listCategories, listQuestions } from '@/lib/grClassic/server/db'

export default async function GrClassicLibraryPage() {
  const t = await grcTeacherPage('/gr-classic/teacher/library')
  if (!t.ok) return <TeachersOnly message={t.error} />
  const categories = await listCategories(t.supabase, t.userId)
  const questions = await listQuestions(t.supabase, categoryNames(categories), t.userId)
  return <QuestionLibrary questions={questions} categories={categories} />
}
