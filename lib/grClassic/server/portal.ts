import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { isGrClassicEnabled } from '../release'
import type { AssignmentSummary, StudentAssignment } from '../types'
import { listStudentAssignments } from './studentAssignments'
import { listTeacherAssignments } from './teacherAssignments'

// The only way the rest of the portal reads GameRoom Classic data: the
// student Assignments and Grades pages and the teacher Assignments and
// Gradebook pages show GameRoom Classic assignments next to their own.
// Both functions return [] when GameRoom Classic is switched off, and
// never throw -- a problem here must not break a portal page.

export async function portalStudentGames(studentId: string | null | undefined): Promise<StudentAssignment[]> {
  if (!isGrClassicEnabled() || !studentId) return []
  try {
    return await listStudentAssignments(createAdminClient(), studentId)
  } catch (e) {
    console.error('GameRoom Classic portal section (student) failed:', e)
    return []
  }
}

export async function portalTeacherGames(supabase: SupabaseClient, userId: string | null | undefined): Promise<AssignmentSummary[]> {
  if (!isGrClassicEnabled() || !userId) return []
  try {
    return await listTeacherAssignments(supabase, userId)
  } catch (e) {
    console.error('GameRoom Classic portal section (teacher) failed:', e)
    return []
  }
}
