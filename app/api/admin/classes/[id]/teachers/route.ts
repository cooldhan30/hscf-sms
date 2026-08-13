import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/admin/classes/[id]/teachers -- add a co-teacher.
// Body: { teacherId }
//
// The first teacher on a class becomes its lead automatically, via the
// sms_classes.teacher_id fallback below; everyone added afterwards is a
// co-teacher with identical access to the roster, attendance,
// assignments and gradebook. The only thing "lead" changes is which name
// is shown beside the class.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const guard = await requireAdmin()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const body = await request.json().catch(() => null)
  const teacherId = body?.teacherId

  if (typeof teacherId !== 'string' || !teacherId) {
    return NextResponse.json({ error: 'teacherId is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { error } = await admin
    .from('sms_class_teachers')
    .insert([{ class_id: params.id, teacher_id: teacherId, assigned_by: guard.profile.id }])

  // 23505 = already teaches this class, which is a no-op not a failure.
  if (error && error.code !== '23505') {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Claim the lead slot only if it is empty.
  await admin
    .from('sms_classes')
    .update({ teacher_id: teacherId })
    .eq('id', params.id)
    .is('teacher_id', null)

  return NextResponse.json({ success: true }, { status: 201 })
}

// DELETE /api/admin/classes/[id]/teachers?teacherId=...
//
// Removing the lead promotes another teacher rather than leaving the
// class showing nobody while co-teachers are still assigned to it.
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const guard = await requireAdmin()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { searchParams } = new URL(request.url)
  const teacherId = searchParams.get('teacherId')

  if (!teacherId) {
    return NextResponse.json({ error: 'teacherId is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { error } = await admin
    .from('sms_class_teachers')
    .delete()
    .eq('class_id', params.id)
    .eq('teacher_id', teacherId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const { data: cls } = await admin
    .from('sms_classes')
    .select('teacher_id')
    .eq('id', params.id)
    .single()

  if (cls?.teacher_id === teacherId) {
    const { data: remaining } = await admin
      .from('sms_class_teachers')
      .select('teacher_id')
      .eq('class_id', params.id)
      .order('assigned_at')
      .limit(1)
      .maybeSingle()

    // Longest-serving remaining teacher takes the lead; null if the class
    // now has none, which is a valid unassigned state.
    await admin
      .from('sms_classes')
      .update({ teacher_id: remaining?.teacher_id ?? null })
      .eq('id', params.id)
  }

  return NextResponse.json({ success: true })
}
