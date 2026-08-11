import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireString, optionalString } from '@/lib/validation'
import { findDuplicateClass } from '@/lib/duplicate-class'

// POST /api/admin/classes -- create a class, optionally assigning a teacher.
//
// Returns 409 + { duplicate } if a class with the same name already exists
// in the same academic year, so the admin can see what the other admin
// already created before deciding. Resend with confirmDuplicate: true to
// create it anyway (multiple sections of one grade are legitimate).
export async function POST(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const errors: string[] = []
  const name = requireString(body.name, 'Class name', errors)
  const gradeLevel = optionalString(body.gradeLevel)
  const teacherId = optionalString(body.teacherId)
  const scheduleDay = optionalString(body.scheduleDay)
  const startTime = optionalString(body.startTime)
  const endTime = optionalString(body.endTime)
  const room = optionalString(body.room)
  const academicYear = optionalString(body.academicYear) || '2026-2027'

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
  }

  const admin = createAdminClient()

  if (!body.confirmDuplicate) {
    const duplicate = await findDuplicateClass(admin, { name, academicYear })
    if (duplicate) {
      return NextResponse.json(
        { error: `A class named "${duplicate.name}" already exists for ${academicYear}.`, duplicate },
        { status: 409 }
      )
    }
  }

  const { data: cls, error } = await admin
    .from('sms_classes')
    .insert([
      {
        name,
        grade_level: gradeLevel,
        teacher_id: teacherId,
        schedule_day: scheduleDay,
        start_time: startTime,
        end_time: endTime,
        room,
        academic_year: academicYear,
      },
    ])
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ class: cls }, { status: 201 })
}
