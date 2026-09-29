import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MeetingRoom } from './MeetingRoom'

// Shared by all four portals' /meetings/[classId] routes. The class is
// read through the caller's own client, so RLS decides whether this page
// renders at all -- a class you have no relationship to is a 404, and the
// token endpoint independently re-checks the same thing before minting
// anything. Neither one trusts the other.
export async function ClassMeetingPage({ classId, standalone = false }: { classId: string; standalone?: boolean }) {
  const supabase = createClient()

  const { data: cls } = await supabase
    .from('sms_classes')
    .select('id, name')
    .eq('id', classId)
    .maybeSingle()

  if (!cls) notFound()

  if (standalone) {
    return <MeetingRoom classId={cls.id} className={cls.name} standalone />
  }

  return (
    <div className="max-w-6xl mx-auto">
      <MeetingRoom classId={cls.id} className={cls.name} />
    </div>
  )
}
