import { NextResponse } from 'next/server'
import { requireGameV2Access } from '@/lib/gameRoomV2/requireAccess'
import { GAME_ENGINES_V2 } from '@/lib/gameRoomV2/registry'

// GET /api/gameroom-v2/engines -- lists the V2 engine registry.
// Entirely separate namespace from /api/game-room/* (legacy); this
// route imports nothing from lib/gameRoom/* and touches no sms_game_*
// table. Gated the same way as app/gameroom-v2/page.tsx (admin or an
// allowlisted tester in sms_gamev2_testers) -- this is foundation-only
// scope: no session/join/answer routes exist yet, since no engine is
// actually playable.
export async function GET() {
  const access = await requireGameV2Access()
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  return NextResponse.json({ engines: GAME_ENGINES_V2 })
}
