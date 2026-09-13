import { redirect } from 'next/navigation'

// Mayangoli is now reached via a "Join a Game" mode dropdown on the
// Game Room page (see GameRoomStudentClient.tsx) rather than its own
// sidebar entry -- this route is kept only so an existing bookmark/
// scanned QR still lands somewhere useful, carrying the join code
// through as a query param.
export default function MayangoliStudentPage({ searchParams }: { searchParams: { code?: string } }) {
  const code = searchParams.code
  redirect(`/student/game-room?mode=mayangoli${code ? `&code=${encodeURIComponent(code)}` : ''}`)
}
