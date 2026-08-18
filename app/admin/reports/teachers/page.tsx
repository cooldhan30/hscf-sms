import { createAdminClient } from '@/lib/supabase/admin'
import { TeacherReportClient, type TeacherReportRow } from './TeacherReportClient'

export const dynamic = 'force-dynamic'

type ClassTeacherRow = {
  teacher_id: string
  class: { name: string; grade_level: string } | null
}

export default async function TeacherReportPage() {
  const admin = createAdminClient()

  const [{ data: teachers }, { data: classTeachers }] = await Promise.all([
    admin
      .from('sms_teachers')
      .select('*, profile:sms_profiles(*)')
      .order('created_at', { ascending: false }),
    admin.from('sms_class_teachers').select('teacher_id, class:sms_classes(name, grade_level)').returns<ClassTeacherRow[]>(),
  ])

  const classesByTeacher = new Map<string, string[]>()
  for (const ct of classTeachers ?? []) {
    if (!ct.class) continue
    const label = `${ct.class.name} (${ct.class.grade_level})`
    const existing = classesByTeacher.get(ct.teacher_id)
    if (existing) existing.push(label)
    else classesByTeacher.set(ct.teacher_id, [label])
  }

  const rows: TeacherReportRow[] = (teachers ?? [])
    .filter((t) => !t.profile?.deleted_at)
    .map((t) => ({
      id: t.id,
      name: `${t.profile?.first_name ?? ''} ${t.profile?.last_name ?? ''}`.trim() || 'Unknown',
      email: t.profile?.email ?? null,
      phone: t.profile?.phone ?? null,
      address: t.profile?.address ?? null,
      employeeId: t.employee_id ?? null,
      subjectSpecialty: t.subject_specialty ?? null,
      classes: classesByTeacher.get(t.id) ?? [],
      isActive: t.profile?.is_active ?? true,
      joinedAt: t.created_at,
    }))

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">Teacher Details</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">
          Every teacher&apos;s contact info, classes taught, and sign-up details.
        </p>
      </div>

      <TeacherReportClient rows={rows} />
    </div>
  )
}
