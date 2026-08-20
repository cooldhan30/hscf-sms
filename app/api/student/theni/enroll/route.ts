import { NextResponse } from 'next/server'
import { requireStudent } from '@/lib/require-student'
import { requireString } from '@/lib/validation'

// POST /api/student/theni/enroll -- join a Tamil Theni season by code.
// Unlike regular class join requests (pending/approved/denied, resolved
// by a teacher), this is instant self-join: there's no single teacher
// who owns a season to approve against, so the enrollment row is
// created directly. See migration 050 for the reasoning.
export async function POST(request: Request) {
  const guard = await requireStudent()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  const { supabase, student } = guard

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const errors: string[] = []
  const code = requireString(body.code, 'Code', errors).toUpperCase()
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
  }

  const { data: matches } = await supabase.rpc('sms_resolve_theni_season_by_join_code', { p_code: code })
  const season = matches?.[0]
  if (!season || !season.is_active) {
    return NextResponse.json({ error: 'Invalid or inactive Tamil Theni code' }, { status: 404 })
  }

  const { data: existing } = await supabase
    .from('sms_theni_enrollments')
    .select('id')
    .eq('season_id', season.season_id)
    .eq('student_id', student.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Already enrolled in this Tamil Theni season' }, { status: 409 })
  }

  const { data: enrollment, error } = await supabase
    .from('sms_theni_enrollments')
    .insert([{ season_id: season.season_id, student_id: student.id }])
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ enrollment, seasonName: season.season_name }, { status: 201 })
}
