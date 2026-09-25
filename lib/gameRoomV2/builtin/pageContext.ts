import 'server-only'
import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { requireGameV2Access } from '@/lib/gameRoomV2/requireAccess'
import { ensureBuiltinContent } from './ensure'
import { loadStudentLearning, type StudentLearning } from './studentLearning'

// Common setup for every GameRoom learning page: sign-in, the existing V2
// access gate (unchanged -- including the GAMEROOM_V2_ENABLED rollback
// allowlist), making sure built-in content is synced, and -- for students
// -- their own learning data.
export type GameRoomPageContext =
  | { ok: false; error: string }
  | {
      ok: true
      role: 'student' | 'teacher' | 'admin'
      userId: string
      firstName: string
      supabase: Extract<Awaited<ReturnType<typeof requireGameV2Access>>, { ok: true }>['supabase']
      studentId: string | null
      learning: StudentLearning | null
    }

export async function loadGameRoomPage(path: string, { withLearning = true } = {}): Promise<GameRoomPageContext> {
  const { userId } = await auth()
  if (!userId) redirect(`/login?next=${encodeURIComponent(path)}`)

  const access = await requireGameV2Access()
  if (!access.ok) return { ok: false, error: access.error }

  await ensureBuiltinContent()

  const role = access.profile.role === 'student' ? 'student' : access.profile.role === 'teacher' ? 'teacher' : 'admin'
  let studentId: string | null = null
  let learning: StudentLearning | null = null
  if (role === 'student') {
    const { data: student } = await access.supabase.from('sms_students').select('id').eq('profile_id', userId).maybeSingle()
    studentId = student?.id ?? null
    if (withLearning) learning = await loadStudentLearning(access.supabase, studentId)
  }

  return { ok: true, role, userId, firstName: access.profile.first_name || '', supabase: access.supabase, studentId, learning }
}
