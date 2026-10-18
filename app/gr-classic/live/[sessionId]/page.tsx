import { notFound } from 'next/navigation'
import { HostLive } from '@/components/grClassic/live/HostLive'
import { TeachersOnly } from '@/components/grClassic/TeachersOnly'
import { grcTeacherPage } from '@/lib/grClassic/server/auth'
import { isUuid } from '@/lib/grClassic/validateQuestion'

// The teacher's screen for a live game they started (e.g. straight from a
// topic). Reloading it returns to the same game. RLS: only the teacher who
// hosts it can see it.
export default async function GrClassicLiveSessionPage({ params }: { params: { sessionId: string } }) {
  if (!isUuid(params.sessionId)) notFound()
  const t = await grcTeacherPage(`/gr-classic/live/${params.sessionId}`)
  if (!t.ok) return <TeachersOnly message={t.error} />
  const { data } = await t.supabase.from('sms_grc_live_sessions').select('id').eq('id', params.sessionId).maybeSingle()
  if (!data) notFound()
  return <HostLive sessionId={params.sessionId} />
}
