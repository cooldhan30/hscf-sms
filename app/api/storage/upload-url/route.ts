import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@/lib/supabase/server'
import { requireTeacher } from '@/lib/require-teacher'
import { requireStudent } from '@/lib/require-student'
import { getB2UploadUrl } from '@/lib/storage/b2'
import { optionalString } from '@/lib/validation'

type Bucket = 'profile-pictures' | 'assignment-images' | 'submissions' | 'resources'

const BUCKET_RULES: Record<Bucket, { maxBytes: number; typePrefix: string | null }> = {
  'profile-pictures': { maxBytes: 5 * 1024 * 1024, typePrefix: 'image/' },
  'assignment-images': { maxBytes: 8 * 1024 * 1024, typePrefix: 'image/' },
  // No prior client-side cap existed for submissions (file or recorded
  // audio) -- this is a new sanity bound, not a preserved one.
  submissions: { maxBytes: 50 * 1024 * 1024, typePrefix: null },
  // Resources can be video/audio/pdf/anything -- no type restriction,
  // just a generous size cap.
  resources: { maxBytes: 200 * 1024 * 1024, typePrefix: null },
}

// POST /api/storage/upload-url -- the single chokepoint for every upload
// in the app. Returns a short-lived presigned URL for the browser to PUT
// the file to directly (Supabase's createSignedUploadUrl, or a B2/S3
// presigned PUT) rather than proxying the bytes through this route --
// Vercel Serverless Functions cap request bodies at 4.5MB, which audio
// submissions in particular would blow past.
//
// Auth here mirrors what each bucket's Storage RLS already enforces
// (see migrations 015, 027, 029): write access is scoped to the caller's
// own {profile_id}/... folder. 'submissions' is the exception -- those
// rows can land on B2, which has no RLS of its own, so the ownership
// check below IS the real enforcement for that bucket, not just a nicer
// error message.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const bucket = optionalString(body.bucket) as Bucket | null
  const fileName = optionalString(body.fileName)
  const contentType = optionalString(body.contentType) || 'application/octet-stream'
  const size = typeof body.size === 'number' ? body.size : null
  const assignmentId = optionalString(body.assignmentId)

  if (!bucket || !(bucket in BUCKET_RULES)) {
    return NextResponse.json({ error: 'Unknown bucket' }, { status: 400 })
  }
  if (!fileName) {
    return NextResponse.json({ error: 'fileName is required' }, { status: 400 })
  }

  const rules = BUCKET_RULES[bucket]
  if (size !== null && size > rules.maxBytes) {
    return NextResponse.json(
      { error: `File must be under ${Math.round(rules.maxBytes / (1024 * 1024))}MB` },
      { status: 400 }
    )
  }
  if (rules.typePrefix && !contentType.startsWith(rules.typePrefix)) {
    return NextResponse.json({ error: 'Please choose an image file.' }, { status: 400 })
  }

  let ownerId: string
  let supabase: ReturnType<typeof createClient>

  if (bucket === 'profile-pictures') {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    supabase = createClient()
    const { data: profile } = await supabase.from('sms_profiles').select('id, is_active').eq('id', userId).single()
    if (!profile || !profile.is_active) {
      return NextResponse.json({ error: 'Account is not active' }, { status: 403 })
    }
    ownerId = userId
  } else if (bucket === 'assignment-images') {
    const guard = await requireTeacher()
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
    supabase = guard.supabase
    ownerId = guard.profile.id
  } else if (bucket === 'submissions') {
    if (!assignmentId) {
      return NextResponse.json({ error: 'assignmentId is required for submissions' }, { status: 400 })
    }
    const guard = await requireStudent()
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
    supabase = guard.supabase
    ownerId = guard.profile.id
  } else {
    // resources: teacher or admin only.
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    supabase = createClient()
    const { data: profile } = await supabase.from('sms_profiles').select('id, role, is_active').eq('id', userId).single()
    if (!profile || !profile.is_active || (profile.role !== 'teacher' && profile.role !== 'admin')) {
      return NextResponse.json({ error: 'Teacher or admin access required' }, { status: 403 })
    }
    ownerId = userId
  }

  const ext = fileName.includes('.') ? fileName.split('.').pop() : null
  const path =
    bucket === 'submissions'
      ? `${ownerId}/${assignmentId}/${Date.now()}-${fileName}`
      : `${ownerId}/${Date.now()}${ext ? `.${ext}` : ''}`

  if (bucket === 'submissions') {
    const uploadUrl = await getB2UploadUrl(path, contentType)
    return NextResponse.json({ path, provider: 'b2', uploadUrl })
  }

  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path)
  if (error || !data) {
    return NextResponse.json({ error: error?.message || 'Failed to create upload URL' }, { status: 400 })
  }

  return NextResponse.json({ path: data.path, provider: 'supabase', token: data.token })
}
