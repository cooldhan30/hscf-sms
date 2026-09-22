import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { FiLock } from 'react-icons/fi'
import { requireGameV2Access } from '@/lib/gameRoomV2/requireAccess'
import { GAME_ENGINES_V2 } from '@/lib/gameRoomV2/registry'
import { EngineStatusBadge } from './EngineStatusBadge'

export const dynamic = 'force-dynamic'

// Deliberately a top-level route, NOT nested under /student or
// /teacher -- middleware's role-gating (lib/supabase/middleware.ts's
// ROLE_PREFIXES) only matches /admin, /teacher, /student, /parent, so
// this route is untouched by that redirect logic and isn't reachable
// from any role's nav (no layout.tsx here adds a sidebar entry
// anywhere). Access is enforced entirely by requireGameV2Access() below
// -- an allowlisted tester or an admin, nobody else, matching Tamil
// Theni's existing "data-gated, not flag-gated" precedent since this
// codebase has no feature-flag system.
export default async function GameRoomV2Page() {
  const { userId } = await auth()
  if (!userId) {
    redirect(`/login?next=${encodeURIComponent('/gameroom-v2')}`)
  }

  const access = await requireGameV2Access()

  if (!access.ok) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-stone-950 px-4">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-stone-200 dark:bg-stone-800 flex items-center justify-center">
            <FiLock className="w-6 h-6 text-stone-500 dark:text-stone-400" />
          </div>
          <h1 className="text-xl font-bold text-stone-800 dark:text-stone-100 mb-1">Not available yet</h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            GameRoom V2 is still in development and isn&apos;t open to your account yet.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 px-4 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-terracotta-600 dark:text-terracotta-400">
            Internal preview{access.isAdmin ? ' · Admin' : ' · Tester'}
          </p>
          <h1 className="text-2xl font-bold text-primary-900 dark:text-white mt-0.5">Tamizhi GameRoom V2</h1>
          <p className="text-stone-500 dark:text-stone-400 mt-1">
            A separate, in-development platform where a teacher builds a Question Set once, then plays it through
            any compatible game engine below. Nothing here is connected to the current GameRoom.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {GAME_ENGINES_V2.map((engine) => (
            <div
              key={engine.id}
              className="p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-bold text-stone-800 dark:text-stone-100">{engine.name}</h2>
                  {engine.tamilName && (
                    <p className="text-sm text-stone-500 dark:text-stone-400">{engine.tamilName}</p>
                  )}
                </div>
                <EngineStatusBadge status={engine.status} />
              </div>
              <p className="text-sm text-stone-600 dark:text-stone-300 mt-2">{engine.description}</p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {engine.compatibility.supportedQuestionTypes.map((t) => (
                  <span
                    key={t}
                    className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
