// Checks the "play by topic" rules (lib/grClassic/topicPlay.ts): what a
// teacher or student may ask for when starting a game from a topic.
// Run with: npx tsx scripts/verify-grc-topics.ts
import { MAX_QUESTIONS, NO_TOPIC, parseTopicPlay, typesFor } from '../lib/grClassic/topicPlay'

let failures = 0
let checks = 0
const ok = (cond: boolean, label: string) => {
  checks++
  if (!cond) {
    failures++
    console.log(`  FAIL: ${label}`)
  }
}

const TOPIC = '3f1c2b9a-1d2e-4f5a-8b6c-7d8e9f0a1b2c'
const good = { topic: TOPIC, type: 'quiz', count: 10, seconds: 20 }

ok(parseTopicPlay(good).ok, 'a normal request is accepted')
ok(parseTopicPlay({ ...good, topic: NO_TOPIC }).ok, 'questions with no topic can be played')
ok(parseTopicPlay({ ...good, count: '15', seconds: '30' }).ok, 'numbers from the address bar are accepted')
ok(!parseTopicPlay({ ...good, topic: 'abc' }).ok, 'a made-up topic is refused')
ok(!parseTopicPlay({ ...good, topic: undefined }).ok, 'a missing topic is refused')
ok(!parseTopicPlay({ ...good, type: 'sentence' }).ok, 'an unknown game type is refused')
ok(!parseTopicPlay({ ...good, type: 'toString' }).ok, 'an inherited property name is not a game type')
ok(!parseTopicPlay({ ...good, count: 0 }).ok, 'zero questions is refused')
ok(!parseTopicPlay({ ...good, count: MAX_QUESTIONS + 1 }).ok, 'more than the maximum is refused')
ok(!parseTopicPlay({ ...good, count: 2.5 }).ok, 'a fraction of a question is refused')
ok(parseTopicPlay({ ...good, count: MAX_QUESTIONS }).ok, 'the maximum is accepted')
ok(!parseTopicPlay({ ...good, seconds: 15 }).ok, 'only the offered times are accepted (live games allow 10/20/30/60)')
for (const s of [10, 20, 30, 60]) ok(parseTopicPlay({ ...good, seconds: s }).ok, `${s}s per question is accepted`)
ok(!parseTopicPlay(null).ok, 'an empty request is refused')

const parsed = parseTopicPlay({ ...good, type: 'word-builder', count: '5' })
ok(parsed.ok && parsed.value.type === 'word-builder' && parsed.value.count === 5, 'the parsed values are typed')

const t = { id: TOPIC, name: 'உயிர்', counts: { quiz: 4, match: 0, 'word-builder': 2 } }
ok(JSON.stringify(typesFor(t)) === JSON.stringify(['quiz', 'word-builder']), 'a topic offers only the game types it has questions for')

console.log(failures ? `${failures} FAILURE(S) of ${checks} checks.` : `PASS: ${checks} checks.`)
process.exit(failures ? 1 : 0)
