// Manually syncs the built-in Tamil content catalog into the database.
// Normally unnecessary: the first GameRoom page load after a deploy does
// this automatically (lib/gameRoomV2/builtin/ensure.ts). Useful to pre-warm
// or to verify from a terminal.
//
//   npx tsx scripts/sync-gameroom-v2-builtin.ts          # sync if needed
//   npx tsx scripts/sync-gameroom-v2-builtin.ts --check  # report only
//
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
// (read from .env.local).
import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import { syncBuiltinContent, isBuiltinContentCurrent } from '../lib/gameRoomV2/builtin/sync'
import { BUILTIN_CONTENT_VERSION, BUILTIN_SET_IDS } from '../lib/gameRoomV2/builtin/catalog'

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

  console.log(`Built-in content version ${BUILTIN_CONTENT_VERSION}, ${BUILTIN_SET_IDS.length} sets.`)
  if (process.argv.includes('--check')) {
    console.log((await isBuiltinContentCurrent(admin)) ? 'Database is up to date.' : 'Database needs a sync.')
    return
  }
  console.log(await syncBuiltinContent(admin))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
