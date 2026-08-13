import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface DuplicateClass {
  id: string
  name: string
  academicYear: string
  gradeLevel: string | null
  scheduleDay: string | null
  startTime: string | null
  endTime: string | null
  room: string | null
  teacherName: string | null
}

type ClassLookupRow = {
  id: string
  name: string
  academic_year: string
  grade_level: string | null
  schedule_day: string | null
  start_time: string | null
  end_time: string | null
  room: string | null
  teacher: { profile: { first_name: string; last_name: string } | null } | null
}

// All admins share one school-wide class list (sms_classes has no owner
// column, and "classes: admin all" is keyed on role, not identity), so two
// admins can still independently create the same class simply by not
// noticing the other already did.
//
// Deliberately advisory, not a UNIQUE constraint: a school legitimately
// runs several sections of the same grade at different times, so the DB
// cannot decide this. The route reports the match and the admin confirms.
export async function findDuplicateClass(
  admin: SupabaseClient,
  { name, academicYear, excludeId }: { name: string; academicYear: string; excludeId?: string }
): Promise<DuplicateClass | null> {
  const { data } = await admin
    .from('sms_classes')
    .select(
      'id, name, academic_year, grade_level, schedule_day, start_time, end_time, room, teacher:sms_teachers!sms_classes_teacher_id_fkey(profile:sms_profiles(first_name, last_name))'
    )
    .eq('academic_year', academicYear)
    .returns<ClassLookupRow[]>()

  if (!data) return null

  const target = normalizeName(name)
  const match = data.find((c) => c.id !== excludeId && normalizeName(c.name) === target)

  if (!match) return null

  return {
    id: match.id,
    name: match.name,
    academicYear: match.academic_year,
    gradeLevel: match.grade_level,
    scheduleDay: match.schedule_day,
    startTime: match.start_time,
    endTime: match.end_time,
    room: match.room,
    teacherName: match.teacher?.profile
      ? `${match.teacher.profile.first_name} ${match.teacher.profile.last_name}`.trim()
      : null,
  }
}

// Compared in JS rather than with .ilike(): a class name is free text and
// may contain % or _, which PostgREST would interpret as wildcards. Also
// collapses internal whitespace so "Nilai  1" matches "Nilai 1".
function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}
