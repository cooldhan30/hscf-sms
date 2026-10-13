import { notFound } from 'next/navigation'
import { HostLive } from '@/components/grClassic/live/HostLive'
import { HostSetup } from '@/components/grClassic/live/HostSetup'
import { TeachersOnly } from '@/components/grClassic/TeachersOnly'
import { grcTeacherPage } from '@/lib/grClassic/server/auth'
import { categoryNames, getGame, listCategories } from '@/lib/grClassic/server/db'
import { hostSession } from '@/lib/grClassic/server/live'
import { teacherClasses } from '@/lib/grClassic/server/teacherAssignments'
import { isUuid } from '@/lib/grClassic/validateQuestion'

// Host a saved game live. With ?class=<id> (or when the teacher has only
// one class) this opens the live game for that class: the same unfinished
// game if there is one, so reloading the projector never starts over.
export default async function GrClassicHostPage({ params, searchParams }: { params: { gameId: string }; searchParams: { class?: string } }) {
  if (!isUuid(params.gameId)) notFound()
  const t = await grcTeacherPage(`/gr-classic/host/${params.gameId}`)
  if (!t.ok) return <TeachersOnly message={t.error} />
  const [game, classes] = await Promise.all([getGame(t.supabase, params.gameId, categoryNames(await listCategories(t.supabase, t.userId))), teacherClasses(t.supabase)])
  if (!game || !game.questions.length) notFound()

  const chosen = searchParams.class ? classes.find((c) => c.id === searchParams.class) : classes.length === 1 ? classes[0] : undefined
  if (!chosen) return <HostSetup gameId={game.id} title={game.title} type={game.type} classes={classes} />
  const sessionId = await hostSession(t.supabase, game, chosen.id)
  return <HostLive sessionId={sessionId} />
}
