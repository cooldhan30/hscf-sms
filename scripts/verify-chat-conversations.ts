// Chat conversation creation (migration 087) -- static regression checks.
// The database behaviour itself is covered by supabase/tests/chat_conversations.sql
// (run against a database with 087 applied; it always rolls back).
//
//   npx tsx scripts/verify-chat-conversations.ts
import { readFileSync } from 'fs'

let failures = 0
function assert(cond: unknown, msg: string) {
  if (!cond) {
    failures++
    console.error(`  FAIL: ${msg}`)
  }
}
const read = (f: string) => readFileSync(f, 'utf8')
const code = (s: string) => s.replace(/--[^\n]*/g, '').replace(/\/\/[^\n]*/g, '')

const lib = code(read('lib/chat.ts'))
assert(/rpc\('sms_get_or_create_direct_conversation'/.test(lib), 'lib/chat opens 1:1 chats through the database function')
assert(/rpc\('sms_create_group_conversation'/.test(lib), 'lib/chat creates groups through the database function')
assert(!/from\('sms_conversation_participants'\)\s*\.insert/.test(lib), 'no client-side participant inserts')
assert(!/from\('sms_conversations'\)\s*\.insert/.test(lib), 'no client-side conversation inserts')
assert(!/SERVICE_ROLE|createAdminClient/.test(lib), 'no privileged credentials in chat code')

const sql = code(read('supabase/migrations/087_chat_idempotent_create_and_membership_hardening.sql'))
assert(!/DISABLE ROW LEVEL SECURITY/i.test(sql), 'RLS never disabled')
assert(!/WITH CHECK\s*\(\s*true\s*\)/i.test(sql), 'no WITH CHECK (true)')
assert(!/DROP CONSTRAINT/i.test(sql), 'unique pair constraint kept')
assert(/ON CONFLICT \(user_a, user_b\) DO NOTHING/.test(sql), 'pair creation is idempotent (ON CONFLICT on the unique pair)')
assert(/COLLATE "C"/.test(sql), 'pair ordered the same way as the table CHECK')
assert((sql.match(/sms_can_chat\(v_me/g) ?? []).length >= 2, 'both functions re-check sms_can_chat')
assert(/p_other_user_id = v_me/.test(sql), 'self-chat rejected')
assert(/VALUES \(v_id, v_a\), \(v_id, v_b\)/.test(sql), 'a 1:1 only ever gets its own two members')
assert((sql.match(/REVOKE ALL ON FUNCTION[^;]+FROM PUBLIC, anon/g) ?? []).length === 3, 'anon cannot execute any new function')
assert(/NOT c\.is_group AND p_user_id IN \(c\.user_a, c\.user_b\)/.test(sql), 'self-insert only into your own 1:1')
assert(/c\.is_group\s+AND p_user_id <> sms_current_user_id\(\)\s+AND sms_is_conversation_participant/.test(sql), 'invites only into groups you belong to')

const test = read('supabase/tests/chat_conversations.sql')
for (const k of ['a_to_b_again_same', 'b_to_a_same', 'existing_row_reused_and_repaired', 'one_row_per_pair', 'unrelated_blocked', 'self_chat_blocked', 'outsider_cannot_join_1to1', 'outsider_cannot_join_group', 'no_third_person_in_1to1', 'needs_identity']) {
  assert(test.includes(k), `SQL regression covers ${k}`)
}
assert(/RAISE EXCEPTION 'CHAT REGRESSION (PASSED|FAILED)/.test(test), 'SQL regression always rolls back')

if (failures) {
  console.error(`FAIL: ${failures} failure(s).`)
  process.exit(1)
}
console.log('PASS: 0 failure(s).')
