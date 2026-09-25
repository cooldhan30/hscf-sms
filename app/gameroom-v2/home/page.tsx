import { redirect } from 'next/navigation'

// The student home now lives at /gameroom-v2 itself (role-aware); this
// path is kept so existing bookmarks/links keep working.
export default function GameRoomV2HomeRedirect() {
  redirect('/gameroom-v2')
}
