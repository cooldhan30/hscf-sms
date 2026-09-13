import { redirect } from 'next/navigation'

// Mayangoli is now reached via a "Game Type" dropdown on the Game Room
// page (see app/teacher/game-room/GameRoomModeSelector.tsx) rather than
// its own sidebar entry -- this route is kept only so any existing
// bookmark/link to /teacher/mayangoli still lands somewhere useful.
export default function MayangoliTeacherPage() {
  redirect('/teacher/game-room')
}
