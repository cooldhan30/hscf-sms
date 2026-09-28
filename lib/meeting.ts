import 'server-only'
import { AccessToken, RoomServiceClient, TrackSource } from 'livekit-server-sdk'
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
export function isModerator(role: SmsRole): boolean {
  return role === 'teacher' || role === 'admin'
}

// "Mute all" (teacher): students may still use camera and screen share,
// but not the microphone, so they can't just unmute themselves. The lock
// is room metadata, so it also applies to anyone who joins or rejoins
// while it's on, and ends when the room empties.
export const SOURCES_WHEN_MICS_LOCKED = [TrackSource.CAMERA, TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO]

export interface MeetingRoomState {
  micsLocked?: boolean
}

export function parseRoomState(metadata: string | undefined | null): MeetingRoomState {
  try {
    return metadata ? (JSON.parse(metadata) as MeetingRoomState) : {}
  } catch {
    return {}
  }
}

// Server-side LiveKit API (moderation). Uses the https form of the server URL.
export function roomService(): RoomServiceClient {
  const url = (process.env.LIVEKIT_URL || process.env.NEXT_PUBLIC_LIVEKIT_URL || '').replace(/^ws/, 'http')
  return new RoomServiceClient(url, process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET)
}

export async function isRoomMicsLocked(classId: string): Promise<boolean> {
  try {
    const [room] = await roomService().listRooms([roomNameForClass(classId)])
    return Boolean(parseRoomState(room?.metadata).micsLocked)
  } catch {
    return false
  }
}

export async function mintMeetingToken(params: {
  classId: string
  profileId: string
  displayName: string
  role: SmsRole
  micsLocked?: boolean
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
    // Joining while the teacher has muted everyone: no microphone.
    ...(!moderator && params.micsLocked ? { canPublishSources: SOURCES_WHEN_MICS_LOCKED } : {}),
    // Only a moderator may end the meeting for everyone.
    canUpdateOwnMetadata: true,
  })

  return token.toJwt()
}
