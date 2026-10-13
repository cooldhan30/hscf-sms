import { JoinLive } from '@/components/grClassic/live/JoinLive'
import { TeachersOnly } from '@/components/grClassic/TeachersOnly'
import { grcStudentPage } from '@/lib/grClassic/server/studentAssignments'

// Students join a live game here (the QR code opens /join?pin=123456).
export default async function GrClassicJoinPage() {
  const s = await grcStudentPage('/gr-classic/join')
  if (!s.ok) return <TeachersOnly who="students" message={s.error} />
  return <JoinLive name={s.firstName} />
}
