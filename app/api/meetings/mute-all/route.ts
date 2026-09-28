import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { TrackType } from 'livekit-server-sdk'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isModerator, parseRoomState, roomNameForClass, roomService, SOURCES_WHEN_MICS_LOCKED } from '@/lib/meeting'
import type { SmsProfile } from '@/types/database'

// POST /api/meetings/mute-all -- teacher/admin only. Body: { classId, lock }
//   lock: true  -> mute every student's mic and take away mic permission,
//                  so they can't unmute themselves ("Mute all")
//   lock: false -> give mic permission back ("Allow mics"); mics stay off
//                  until each student turns theirs on
// Enforced by the LiveKit server with our API secret, never by a message
// between browsers -- a student can't trigger or undo it. Teachers and
// admins in the room are never touched.
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const classId = body?.classId
  const lock = body?.lock
  if (typeof classId !== 'string' || !classId || typeof lock !== 'boolean') {
    return NextResponse.json({ error: 'classId and lock are required' }, { status: 400 })
  }

  const supabase = createClient()
  const { data: profile } = await supabase.from('sms_profiles').select('*').eq('id', userId).single<SmsProfile>()
  if (!profile || !profile.is_active || !isModerator(profile.role)) {
    return NextResponse.json({ error: 'Only a teacher can mute the class' }, { status: 403 })
  }
  // Same entitlement as joining: RLS returns the class only to its own
  // teachers (co-teachers included) and admins.
  const { data: cls } = await supabase.from('sms_classes').select('id').eq('id', classId).maybeSingle()
  if (!cls) return NextResponse.json({ error: 'You do not have access to this class' }, { status: 403 })

  const room = roomNameForClass(classId)
  const svc = roomService()

  try {
    const [roomInfo] = await svc.listRooms([room])
    if (!roomInfo) return NextResponse.json({ error: 'The meeting is not running' }, { status: 404 })

    await svc.updateRoomMetadata(room, JSON.stringify({ ...parseRoomState(roomInfo.metadata), micsLocked: lock }))

    const participants = await svc.listParticipants(room)
    // Roles come from our database, not from anything a participant can set
    const { data: roles } = await createAdminClient()
      .from('sms_profiles')
      .select('id, role')
      .in('id', participants.map((p) => p.identity))
    const moderatorIds = new Set((roles ?? []).filter((r) => isModerator(r.role)).map((r) => r.id))

    let affected = 0
    for (const p of participants) {
      if (moderatorIds.has(p.identity)) continue
      if (lock) {
        for (const t of p.tracks) {
          if (t.type === TrackType.AUDIO && !t.muted) await svc.mutePublishedTrack(room, p.identity, t.sid, true)
        }
      }
      // Permissions are replaced as a whole, so everything is spelled out.
      // An empty source list means every source is allowed again.
      await svc.updateParticipant(room, p.identity, {
        permission: {
          canSubscribe: true,
          canPublish: true,
          canPublishData: true,
          canUpdateMetadata: true,
          canPublishSources: lock ? SOURCES_WHEN_MICS_LOCKED : [],
        },
      })
      affected++
    }

    return NextResponse.json({ micsLocked: lock, affected })
  } catch (err) {
    console.error('mute-all failed', err)
    return NextResponse.json({ error: 'Could not update the meeting. Try again.' }, { status: 502 })
  }
}
