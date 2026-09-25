// Verifies the built-in Tamil content catalog (lib/gameRoomV2/builtin):
//   1. every question passes the SAME validateQuestionPayload() the
//      Builder API enforces on teacher content;
//   2. ids are deterministic uuids and unique across the whole catalog;
//   3. every required topic from the release spec exists;
//   4. every topic is playable by at least one engine, and every set by
//      at least one engine; quiz sets are Live Classroom-capable;
//   5. boards reference real topics, and there are no duplicate
//      prompts inside a set (which would collapse question ids);
//   6. multiple-choice correct answers are not always in slot 0;
//   7. Tamil text is NFC-normalized (no invisible variants that would
//      fail text comparison at grading time).
//
//   npx tsx scripts/verify-gameroom-v2-builtin-content.ts
import { validateQuestionPayload } from '../lib/gameRoomV2/domain'
import { GAME_ENGINES_V2 } from '../lib/gameRoomV2/registry'
import {
  BUILTIN_TOPICS,
  LEARNING_BOARDS,
  BUILTIN_SET_IDS,
  BUILTIN_CONTENT_VERSION,
  enginesForTopic,
  getBuiltinTopic,
  isBuiltinSetId,
} from '../lib/gameRoomV2/builtin/catalog'
import { builtinUuid } from '../lib/gameRoomV2/builtin/ids'

let failures = 0
function fail(msg: string) {
  console.error(`  FAIL: ${msg}`)
  failures++
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

console.log('== 1. Every built-in question validates ==')
let questionCount = 0
for (const topic of BUILTIN_TOPICS) {
  for (const set of topic.sets) {
    if (set.questions.length === 0) fail(`${topic.key}/${set.kind} has no questions`)
    set.questions.forEach((q, i) => {
      questionCount++
      const problems = validateQuestionPayload(q.questionType, q.prompt, q.payload)
      if (problems.length > 0) fail(`${topic.key}/${set.kind} Q${i + 1} "${q.prompt}": ${problems.join('; ')}`)
    })
  }
}
console.log(`  Validated ${questionCount} questions in ${BUILTIN_SET_IDS.length} sets across ${BUILTIN_TOPICS.length} topics.`)

console.log('\n== 2. Deterministic, unique ids ==')
const allIds = new Set<string>()
for (const topic of BUILTIN_TOPICS) {
  for (const set of topic.sets) {
    for (const id of [set.id, ...set.questionIds]) {
      if (!UUID.test(id)) fail(`not a v5-shaped uuid: ${id}`)
      if (allIds.has(id)) fail(`duplicate id ${id} (${topic.key}/${set.kind})`)
      allIds.add(id)
    }
    if (set.id !== builtinUuid(`set:${topic.key}:${set.kind}`)) fail(`set id for ${topic.key}/${set.kind} is not deterministic`)
    if (!isBuiltinSetId(set.id)) fail(`isBuiltinSetId false for ${set.id}`)
  }
}
if (isBuiltinSetId('00000000-0000-4000-8000-000000000000')) fail('isBuiltinSetId accepted a random uuid')
if (!/^[0-9a-f]{12}$/.test(BUILTIN_CONTENT_VERSION)) fail(`bad content version ${BUILTIN_CONTENT_VERSION}`)
console.log(`  ${allIds.size} unique ids; content version ${BUILTIN_CONTENT_VERSION}.`)

console.log('\n== 3. Required topics exist ==')
const REQUIRED = [
  'உயிரெழுத்துகள்', 'மெய்யெழுத்துகள்', 'உயிர்மெய்யெழுத்துகள்', 'ஆய்த எழுத்து',
  'குறில்', 'நெடில்', 'வல்லினம்', 'மெல்லினம்', 'இடையினம்',
  'உடல் உறுப்புகள்', 'விலங்குகள்', 'பறவைகள்', 'பழங்கள்', 'காய்கறிகள்', 'நிறங்கள்', 'எண்கள்',
  'குடும்பம்', 'பள்ளி', 'வீடு', 'உணவு', 'இயற்கை', 'தொழில்கள்', 'போக்குவரத்து',
  'திணை', 'பால்', 'எண்', 'காலம்', 'இடம்',
]
for (const title of REQUIRED) {
  if (!BUILTIN_TOPICS.some((t) => t.tamilTitle === title)) fail(`missing required topic ${title}`)
}
console.log(`  Checked ${REQUIRED.length} required topics.`)

console.log('\n== 4. Playability ==')
for (const topic of BUILTIN_TOPICS) {
  const engines = enginesForTopic(topic)
  if (engines.length === 0) fail(`${topic.key} has no compatible engine`)
  for (const set of topic.sets) {
    const playable = GAME_ENGINES_V2.some(
      (e) => (e.status === 'ACTIVE' || e.status === 'BETA') && set.questionTypes.every((t) => e.compatibility.supportedQuestionTypes.includes(t))
    )
    if (!playable) fail(`${topic.key}/${set.kind} is playable by no engine`)
  }
  const hasLive = engines.some(({ engine }) => engine.compatibility.liveClassroomSupport)
  if (!hasLive) fail(`${topic.key} has no Live Classroom-capable engine`)
}
console.log(`  Checked ${BUILTIN_TOPICS.length} topics.`)

console.log('\n== 5. Boards and prompt uniqueness ==')
for (const board of LEARNING_BOARDS) {
  if (board.topicKeys.length === 0) fail(`board ${board.id} is empty`)
  for (const key of board.topicKeys) if (!getBuiltinTopic(key)) fail(`board ${board.id} references missing topic ${key}`)
}
for (const topic of BUILTIN_TOPICS) {
  if (!LEARNING_BOARDS.some((b) => b.topicKeys.includes(topic.key))) fail(`topic ${topic.key} is on no board`)
  for (const set of topic.sets) {
    const seen = new Set<string>()
    set.questions.forEach((q) => {
      const identity = `${q.prompt}|${JSON.stringify(q.payload)}`
      if (seen.has(identity)) fail(`${topic.key}/${set.kind} duplicate question "${q.prompt}"`)
      seen.add(identity)
    })
  }
}
console.log(`  Checked ${LEARNING_BOARDS.length} boards.`)

console.log('\n== 6. Answer position spread ==')
let mcTotal = 0
let firstSlot = 0
for (const topic of BUILTIN_TOPICS)
  for (const set of topic.sets)
    for (const q of set.questions)
      if (q.questionType === 'MULTIPLE_CHOICE') {
        const p = q.payload as { options: string[]; correctAnswer: string }
        mcTotal++
        if (p.options[0] === p.correctAnswer) firstSlot++
      }
const share = firstSlot / Math.max(1, mcTotal)
if (share > 0.5) fail(`correct answer is in slot 0 for ${(share * 100).toFixed(0)}% of MC questions`)
console.log(`  ${firstSlot}/${mcTotal} MC answers in slot 0.`)

console.log('\n== 7. NFC-normalized text ==')
let textCount = 0
for (const topic of BUILTIN_TOPICS) {
  for (const text of [topic.tamilTitle, topic.description, ...topic.sets.flatMap((s) => s.questions.map((q) => q.prompt + JSON.stringify(q.payload)))]) {
    textCount++
    if (text.normalize('NFC') !== text) fail(`not NFC: ${text.slice(0, 40)}`)
    if (/[​-‍﻿]/.test(text)) fail(`zero-width character in: ${text.slice(0, 40)}`)
  }
}
console.log(`  Checked ${textCount} strings.`)

if (failures > 0) {
  console.error(`\n${failures} failure(s).`)
  process.exit(1)
}
console.log('\nAll built-in content checks passed.')
