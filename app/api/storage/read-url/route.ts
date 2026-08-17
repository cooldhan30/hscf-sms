import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@/lib/supabase/server'
import { getSubmissionSignedUrl } from '@/lib/storage/submissionUrl'
import { optionalString } from '@/lib/validation'

const SIGNED_URL_TTL_SECONDS = 60 * 60

// POST /api/storage/read-url -- signed GET URL for a private 'submissions'
// object, from either provider. Only 'submissions' needs this: the other
// two buckets are public (see migrations 027, 029) and just use their
// public URL directly, no signing involved.
//
// B2 objects have no RLS of their own, so this route re-derives the same
// access rule Storage RLS enforces for 'supabase' rows (migration 015) --
// admin, the assignment's own teacher, the student who owns it, or that
// student's linked parent -- by checking the submission row itself
// (owning profile is the path's first segment) rather than trusting the
// caller.
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const path = optionalString(body.path)
  const provider = optionalString(body.provider)
  if (!path || (provider !== 'supabase' && provider !== 'b2')) {
    return NextResponse.json({ error: 'path and provider are required' }, { status: 400 })
  }

  const supabase = createClient()

  const { data: profile } = await supabase.from('sms_profiles').select('id, role, is_active').eq('id', userId).single()
  if (!profile || !profile.is_active) {
    return NextResponse.json({ error: 'Account is not active' }, { status: 403 })
  }

  const ownerId = path.split('/')[0]
  const assignmentId = path.split('/')[1]

  let allowed = profile.role === 'admin' || ownerId === userId

  if (!allowed && profile.role === 'teacher' && assignmentId) {
    const { data } = await supabase.rpc('sms_teacher_owns_assignment', { p_assignment_id: assignmentId })
    allowed = Boolean(data)
  }

  if (!allowed && profile.role === 'parent') {
    const { data: student } = await supabase.from('sms_students').select('id').eq('profile_id', ownerId).maybeSingle()
    if (student) {
      const { data: link } = await supabase
        .from('sms_student_parents')
        .select('student_id, parent:sms_parents!inner(profile_id)')
        .eq('student_id', student.id)
        .eq('parent.profile_id', userId)
        .maybeSingle()
      allowed = Boolean(link)
    }
  }

  if (!allowed) {
    return NextResponse.json({ error: 'Not authorized to view this file' }, { status: 403 })
  }

  const signedUrl = await getSubmissionSignedUrl(supabase, path, provider, SIGNED_URL_TTL_SECONDS)
  if (!signedUrl) {
    return NextResponse.json({ error: 'Failed to create signed URL' }, { status: 400 })
  }
  return NextResponse.json({ signedUrl })
}
