import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@/lib/supabase/server'
import { isModerator, isRoomMicsLocked, mintMeetingToken } from '@/lib/meeting'
import type { SmsProfile } from '@/types/database'

// POST /api/meetings/token -- issue a LiveKit token for a class meeting.
// Body: { classId }
//
// Entitlement is decided by RLS, not by a hand-written role check here.
// sms_classes already has policies for every role -- admin sees all,
// a teacher sees classes they teach, a student sees classes they are
// enrolled in, a parent sees their children's classes. So: read the
// class through the CALLER'S OWN client, and if a row comes back they
// belong in that meeting. One source of truth, and it cannot drift from
// the rest of the app the way a duplicated check would.
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Checked before any work: without these, mintMeetingToken throws and
  // the caller gets an opaque 500. A missing deployment variable is a
  // configuration problem, not a server fault, and the message should
  // say which one so it can be fixed without reading the logs.
  if (!process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET || !process.env.NEXT_PUBLIC_LIVEKIT_URL) {
    return NextResponse.json(
      { error: 'Meetings are not configured yet. LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET and NEXT_PUBLIC_LIVEKIT_URL must be set.' },
      { status: 503 }
    )
  }

  const body = await request.json().catch(() => null)
  const classId = body?.classId

  if (typeof classId !== 'string' || !classId) {
    return NextResponse.json({ error: 'classId is required' }, { status: 400 })
  }

  const supabase = createClient()

  const { data: cls } = await supabase
    .from('sms_classes')
    .select('id, name')
    .eq('id', classId)
    .maybeSingle()

  if (!cls) {
    // Either the class doesn't exist or this person has no relationship
    // to it. Deliberately the same answer for both, so this endpoint
    // can't be used to probe which class ids are real.
    return NextResponse.json({ error: 'You do not have access to this class' }, { status: 403 })
  }

  const { data: profile } = await supabase
    .from('sms_profiles')
    .select('*')
    .eq('id', userId)
    .single<SmsProfile>()

  if (!profile || !profile.is_active) {
    return NextResponse.json({ error: 'Account is not active' }, { status: 403 })
  }

  const token = await mintMeetingToken({
    classId,
    profileId: userId,
    displayName: `${profile.first_name} ${profile.last_name}`.trim() || 'Participant',
    role: profile.role,
    micsLocked: isModerator(profile.role) ? false : await isRoomMicsLocked(classId),
  })

  return NextResponse.json({
    token,
    serverUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL,
    className: cls.name,
    canModerate: isModerator(profile.role),
  })
}
