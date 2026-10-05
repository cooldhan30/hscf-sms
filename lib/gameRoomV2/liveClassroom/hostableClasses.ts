import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

// The classes a teacher can host a live game for: every class they teach,
// as primary teacher OR co-teacher (sms_class_teachers) -- the same rule
// /api/gameroom-v2/live/host enforces through sms_teacher_owns_class().
// Admins can host for every class. Shared by the GameRoom home and
// /api/gameroom-v2/live/host-options. Not barreled from ./index (server-only).
export interface HostableClass {
  id: string
  name: string
  grade_level: string | null
}

export async function hostableClasses(teacherId: string | null, isAdmin: boolean): Promise<HostableClass[]> {
  const admin = createAdminClient()
  if (isAdmin) {
    const { data } = await admin.from('sms_classes').select('id, name, grade_level').order('name')
    return data ?? []
  }
  if (!teacherId) return []
  const [{ data: primary }, { data: assigned }] = await Promise.all([
    admin.from('sms_classes').select('id').eq('teacher_id', teacherId),
    admin.from('sms_class_teachers').select('class_id').eq('teacher_id', teacherId),
  ])
  const ids = Array.from(new Set([...(primary ?? []).map((c) => c.id as string), ...(assigned ?? []).map((c) => c.class_id as string)]))
  if (!ids.length) return []
  const { data } = await admin.from('sms_classes').select('id, name, grade_level').in('id', ids).order('name')
  return data ?? []
}

// A teacher's sms_teachers.id from their profile id (null if they have none).
export async function teacherIdForProfile(profileId: string): Promise<string | null> {
  const { data } = await createAdminClient().from('sms_teachers').select('id').eq('profile_id', profileId).maybeSingle()
  return data?.id ?? null
}
