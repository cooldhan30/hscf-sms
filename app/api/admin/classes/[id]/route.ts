import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { optionalString } from '@/lib/validation'
import { findDuplicateClass } from '@/lib/duplicate-class'

// PATCH /api/admin/classes/[id] -- edit class fields / reassign teacher.
//
// A rename can collide with another admin's class the same way a create
// can, so it runs the same advisory check (excluding this class itself).
// See POST /api/admin/classes and lib/duplicate-class.ts.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const guard = await requireAdmin()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const admin = createAdminClient()

  const updates: Record<string, unknown> = {}
  if ('name' in body) updates.name = optionalString(body.name)
  if ('gradeLevel' in body) updates.grade_level = optionalString(body.gradeLevel)
  if ('teacherId' in body) updates.teacher_id = optionalString(body.teacherId)
  if ('scheduleDay' in body) updates.schedule_day = optionalString(body.scheduleDay)
  if ('startTime' in body) updates.start_time = optionalString(body.startTime)
  if ('endTime' in body) updates.end_time = optionalString(body.endTime)
  if ('room' in body) updates.room = optionalString(body.room)
  if ('academicYear' in body) updates.academic_year = optionalString(body.academicYear)

  if (typeof updates.name === 'string' && !body.confirmDuplicate) {
    // academic_year may not be in this PATCH -- fall back to the row's
    // current value, since that's the year the rename would land in.
    const { data: current } = await admin
      .from('sms_classes')
      .select('academic_year')
      .eq('id', params.id)
      .single()

    const academicYear = (updates.academic_year as string | null) ?? current?.academic_year

    if (academicYear) {
      const duplicate = await findDuplicateClass(admin, {
        name: updates.name,
        academicYear,
        excludeId: params.id,
      })
      if (duplicate) {
        return NextResponse.json(
          { error: `A class named "${duplicate.name}" already exists for ${academicYear}.`, duplicate },
          { status: 409 }
        )
      }
    }
  }

  const { error } = await admin.from('sms_classes').update(updates).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true })
}
