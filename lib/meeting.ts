import 'server-only'
import { AccessToken } from 'livekit-server-sdk'
import type { SmsRole } from '@/types/database'

// One permanent room per class, derived from the class id rather than
// stored. There is no scheduled start or end -- the room simply exists,
// and a class meeting is "whoever is currently in it". LiveKit creates a
// room on first join and reaps it when the last person leaves, so an
// empty room costs nothing and the same URL works every week.
export function roomNameForClass(classId: string): string {
  return `class-${classId}`
}

// Teachers and admins run the meeting: they can mute, remove, and end it
// for everyone. Students and parents take part but cannot moderate --
// a student must not be able to eject their classmates.
function isModerator(role: SmsRole): boolean {
  return role === 'teacher' || role === 'admin'
}

export async function mintMeetingToken(params: {
  classId: string
  profileId: string
  displayName: string
  role: SmsRole
}): Promise<string> {
  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET

  if (!apiKey || !apiSecret) {
    throw new Error('Missing LIVEKIT_API_KEY or LIVEKIT_API_SECRET')
  }

  const moderator = isModerator(params.role)

  const token = new AccessToken(apiKey, apiSecret, {
    identity: params.profileId,
    name: params.displayName,
    // Long enough for a full Saturday session without a mid-class
    // reconnect prompt. The token only grants this one room.
    ttl: '12h',
  })

  token.addGrant({
    room: roomNameForClass(params.classId),
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    // Moderation powers, including muting others and removing them.
    roomAdmin: moderator,
    // Only a moderator may end the meeting for everyone.
    canUpdateOwnMetadata: true,
  })

  return token.toJwt()
}
