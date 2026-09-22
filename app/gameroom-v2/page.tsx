import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import Link from 'next/link'
import { FiLock, FiCompass, FiEdit3 } from 'react-icons/fi'
import { requireGameV2Access } from '@/lib/gameRoomV2/requireAccess'
import { GAME_ENGINES_V2 } from '@/lib/gameRoomV2/registry'
import { GameTile, type GameTileAccent } from '@/components/gameRoomV2'

export const dynamic = 'force-dynamic'

const TILE_ACCENTS: GameTileAccent[] = ['ink', 'coral', 'mint', 'cyan', 'magenta']

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
    <div className="min-h-screen bg-stone-50 dark:bg-gamev2ink-950 px-4 sm:px-6 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-gamev2spark-600 dark:text-gamev2spark-400">
              Internal preview{access.isAdmin ? ' · Admin' : ' · Tester'}
            </p>
            <h1 className="text-2xl font-black text-gamev2ink-900 dark:text-white mt-0.5">Tamizhi GameRoom V2</h1>
            <p className="text-gamev2ink-500 dark:text-gamev2ink-400 mt-1 max-w-lg">
              A teacher builds a Question Set once, then plays it through any compatible game engine below. Nothing
              here is connected to the current GameRoom.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Link
              href="/gameroom-v2/home"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-gamev2ink-600 dark:text-gamev2ink-300 hover:text-gamev2ink-800 dark:hover:text-white whitespace-nowrap"
            >
              Student Home
            </Link>
            <Link
              href="/gameroom-v2/builder"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-gamev2ink-600 dark:text-gamev2ink-300 hover:text-gamev2ink-800 dark:hover:text-white whitespace-nowrap"
            >
              <FiEdit3 className="w-4 h-4" /> Question Set Builder
            </Link>
            <Link
              href="/gameroom-v2/design"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-gamev2ink-600 dark:text-gamev2ink-300 hover:text-gamev2ink-800 dark:hover:text-white whitespace-nowrap"
            >
              <FiCompass className="w-4 h-4" /> Design Gallery
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {GAME_ENGINES_V2.map((engine, i) => (
            <GameTile
              key={engine.id}
              title={engine.name}
              tamilTitle={engine.tamilName}
              icon={<span>🎮</span>}
              accent={TILE_ACCENTS[i % TILE_ACCENTS.length]}
              status={engine.status}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
