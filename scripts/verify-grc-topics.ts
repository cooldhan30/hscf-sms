// Checks the "play by topic" rules (lib/grClassic/topicPlay.ts): what a
// teacher or student may ask for when starting a game or an assignment
// from one or more topics, and how questions are drawn from them.
// Run with: npx tsx scripts/verify-grc-topics.ts
import { MAX_QUESTIONS, MAX_TOPICS, NO_TOPIC, combineTopics, mergeTopicScores, parsePlayed, parseTopicPlay, pickEvenly, tallyByTopic, topicsTitle, typesFor } from '../lib/grClassic/topicPlay'
import { repeatsIn, sameQuestionKey, withoutRepeats } from '../lib/grClassic/sameQuestion'
import { compareTopics, groupTopics, topicPlace } from '../lib/grClassic/topicOrder'
import type { Question } from '../lib/grClassic/types'

let failures = 0
let checks = 0
const ok = (cond: boolean, label: string) => {
  checks++
  if (!cond) {
    failures++
    console.log(`  FAIL: ${label}`)
  }
}

const A = '3f1c2b9a-1d2e-4f5a-8b6c-7d8e9f0a1b2c'
const B = '9a8b7c6d-5e4f-4a3b-9c2d-1e0f2a3b4c5d'
const good = { topics: [A], type: 'quiz', count: 10, seconds: 20 }
const topicsOf = (input: Record<string, unknown>) => {
  const r = parseTopicPlay(input)
  return r.ok ? r.value.topics.join(',') : 'refused'
}

// ---- One topic ----
ok(parseTopicPlay(good).ok, 'a normal request is accepted')
ok(topicsOf({ ...good, topics: undefined, topic: A }) === A, 'an older single-topic link still works')
ok(parseTopicPlay({ ...good, topics: [NO_TOPIC] }).ok, 'questions with no topic can be played')
ok(parseTopicPlay({ ...good, count: '15', seconds: '30' }).ok, 'numbers from the address bar are accepted')
ok(!parseTopicPlay({ ...good, topics: ['abc'] }).ok, 'a made-up topic is refused')
ok(!parseTopicPlay({ ...good, topics: [] }).ok, 'no topic at all is refused')
ok(!parseTopicPlay({ ...good, topics: undefined }).ok, 'a missing topic is refused')

// ---- Several topics ----
ok(topicsOf({ ...good, topics: [A, B] }) === `${A},${B}`, 'two topics are accepted, in order')
ok(topicsOf({ ...good, topics: `${A},${B}` }) === `${A},${B}`, 'two topics from a link (comma separated) are accepted')
ok(topicsOf({ ...good, topics: [A, B, A] }) === `${A},${B}`, 'a topic picked twice counts once')
ok(topicsOf({ ...good, topics: [A, NO_TOPIC] }) === `${A},${NO_TOPIC}`, 'a topic can be combined with the no-topic questions')
ok(!parseTopicPlay({ ...good, topics: [A, 'abc'] }).ok, 'one bad topic in the list refuses the request')
ok(!parseTopicPlay({ ...good, topics: [A, 42] }).ok, 'a topic that is not text is refused')
const many = Array.from({ length: MAX_TOPICS + 1 }, (_, i) => `${String(i).padStart(8, '0')}-1d2e-4f5a-8b6c-7d8e9f0a1b2c`)
ok(parseTopicPlay({ ...good, topics: many.slice(0, MAX_TOPICS) }).ok, `${MAX_TOPICS} topics are accepted`)
ok(!parseTopicPlay({ ...good, topics: many }).ok, `more than ${MAX_TOPICS} topics are refused`)

// ---- Type, count and time ----
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

// ---- Combining topics ----
const tA = { id: A, name: 'உயிர்', counts: { quiz: 4, match: 0, 'word-builder': 2 } }
const tB = { id: B, name: 'திணை', counts: { quiz: 3, match: 1, 'word-builder': 0 } }
ok(JSON.stringify(typesFor(tA)) === JSON.stringify(['quiz', 'word-builder']), 'a topic offers only the game types it has questions for')
const both = combineTopics([tA, tB])!
ok(both.counts.quiz === 7 && both.counts.match === 1 && both.counts['word-builder'] === 2, 'combined topics add up their question counts')
ok(typesFor(both).length === 3, 'combined topics offer every game type either one has')
ok(both.name === 'உயிர் + திணை', 'combined topics are named "A + B"')
ok(combineTopics([]) === null, 'no topics combine to nothing')
ok(topicsTitle(['x'.repeat(80), 'y'.repeat(80)]).length === 118 && topicsTitle(['x'.repeat(80), 'y'.repeat(80)]).endsWith('…'), 'a long combined title is shortened to fit')

// ---- Drawing questions evenly ----
const keep = <U>(items: U[]) => items.slice() // no shuffling: predictable
const big = Array.from({ length: 100 }, (_, i) => `a${i}`)
const small = ['b0', 'b1', 'b2']
const ten = pickEvenly([big, small], 10, keep)
ok(ten.length === 10, 'draws the number asked for')
ok(ten.filter((x) => x.startsWith('b')).length === 3, 'a small topic gives all it has when the other is big')
const even = pickEvenly([big, big.map((x) => x.replace('a', 'c'))], 10, keep)
ok(even.filter((x) => x.startsWith('a')).length === 5 && even.filter((x) => x.startsWith('c')).length === 5, 'two big topics give half each')
ok(new Set(pickEvenly([big, small], 103, keep)).size === 103, 'asking for everything gives every question exactly once')
ok(pickEvenly([big, small], 500, keep).length === 103, 'never more than the topics have')
ok(pickEvenly([[], small], 2, keep).length === 2, 'an empty topic is skipped')
const randomDraw = pickEvenly([big, small], 6)
ok(randomDraw.length === 6 && randomDraw.filter((x) => x.startsWith('b')).length === 3, 'with shuffling, the mix is still even')

// ---- Play Offline scores per topic ----
const q = (n: number) => `${String(n).padStart(8, '0')}-aaaa-4bbb-8ccc-dddddddddddd`
const topicOf = new Map<string, string | null>([
  [q(1), A],
  [q(2), A],
  [q(3), B],
  [q(4), null],
])
const tally = tallyByTopic(
  [
    { questionId: q(1), correct: 1, total: 1 },
    { questionId: q(2), correct: 0, total: 1 },
    { questionId: q(3), correct: 3, total: 4 }, // a match board: 3 of 4 pairs
    { questionId: q(4), correct: 1, total: 1 },
    { questionId: q(9), correct: 1, total: 1 }, // not in the library: left out
  ],
  topicOf
)
const byTopic = new Map(tally.map((t) => [t.topic, t]))
ok(tally.length === 3, 'a combined game is added up per topic')
ok(byTopic.get(A)?.answered === 2 && byTopic.get(A)?.correct === 1 && byTopic.get(A)?.percent === 50, 'each topic gets its own score')
ok(byTopic.get(B)?.answered === 4 && byTopic.get(B)?.percent === 75, 'match pairs count one by one')
ok(byTopic.get(NO_TOPIC)?.percent === 100, 'questions with no topic count as their own topic')
ok(!tally.some((t) => t.answered === 0), 'questions not in the library are left out')
ok(tallyByTopic([{ questionId: q(1), correct: 5, total: 1 }], topicOf)[0].correct === 1, 'never more right than asked')
ok(tallyByTopic([], topicOf).length === 0, 'an empty game adds nothing')

ok(parsePlayed([{ questionId: q(1), correct: 1, total: 1 }])?.length === 1, 'a finished game is accepted')
ok(parsePlayed([]) === null, 'an empty game is refused')
ok(parsePlayed('x') === null, 'not a list is refused')
ok(parsePlayed([{ questionId: 'x', correct: 1, total: 1 }]) === null, 'a made-up question is refused')
ok(parsePlayed([{ questionId: q(1), correct: 2, total: 1 }]) === null, 'more right than the question has is refused')
ok(parsePlayed([{ questionId: q(1), correct: -1, total: 1 }]) === null, 'a negative score is refused')
ok(parsePlayed([{ questionId: q(1), correct: 1, total: 0 }]) === null, 'a question with nothing in it is refused')
ok(parsePlayed(Array.from({ length: MAX_QUESTIONS + 1 }, () => ({ questionId: q(1), correct: 1, total: 1 }))) === null, 'more questions than a game can have is refused')

// ---- The dashboard: Play Offline + live games + assignments ----
const day = (d: number) => new Date(Date.UTC(2026, 9, d, 12)).toISOString()
const merged = mergeTopicScores(
  // Play Offline, as stored (already per topic); the database writes dates its own way.
  [{ topic: A, plays: 3, answered: 10, correct: 6, bestPercent: 80, lastPercent: 60, lastPlayedAt: '2026-10-05 12:00:00+00' }],
  [
    { source: 'live', at: day(7), tallies: [{ topic: A, answered: 5, correct: 5, percent: 100 }, { topic: B, answered: 4, correct: 1, percent: 25 }] },
    { source: 'assignment', at: day(9), tallies: [{ topic: A, answered: 5, correct: 2, percent: 40 }] },
    { source: 'assignment', at: day(8), tallies: [{ topic: B, answered: 0, correct: 0, percent: 0 }] }, // nothing answered: ignored
  ],
  (t) => (t === A ? 'உயிர்' : 'திணை')
)
const mA = merged.find((m) => m.topic === A)!
const mB = merged.find((m) => m.topic === B)!
ok(merged.length === 2, 'one row per topic, whatever the source')
ok(mA.answered === 20 && mA.correct === 13, 'right / answered add up across offline, live and assignments')
ok(mA.plays === 5 && mA.playsBy.offline === 3 && mA.playsBy.live === 1 && mA.playsBy.assignment === 1, 'plays are counted per source')
ok(mA.bestPercent === 100, 'best is the best single game, from any source')
ok(mA.lastPercent === 40 && mA.lastPlayedAt === day(9), 'last is the most recent game (an assignment here)')
ok(mB.plays === 1 && mB.playsBy.assignment === 0, 'a game with nothing answered in a topic does not count')
ok(merged[0].topic === A, 'the most recently played topic comes first')
ok(mA.name === 'உயிர்' && mB.name === 'திணை', 'topics get their names')
const offlineOnly = mergeTopicScores([{ topic: A, plays: 1, answered: 1, correct: 1, bestPercent: 100, lastPercent: 100, lastPlayedAt: '2026-10-20 08:00:00+00' }], [{ source: 'live', at: day(7), tallies: [{ topic: A, answered: 1, correct: 0, percent: 0 }] }], () => 'x')
ok(offlineOnly[0].lastPercent === 100, 'dates written differently (database vs browser) still compare as times')
ok(mergeTopicScores([], [], () => 'x').length === 0, 'nothing played: an empty dashboard')

// ---- No question twice in a game ----
const base = { categoryId: null, category: '', difficulty: 'easy' as const }
const choice = (id: string, prompt: string, options: string[], answerIndex: number): Question => ({ ...base, id, kind: 'choice', prompt, options, answerIndex })
const nounA = choice('1', 'இவற்றில் பெயர்ச்சொல் எது?', ['நீந்து', 'மரம்', 'பார்', 'பாடு'], 1)
const nounSameAnswer = choice('2', 'இவற்றில்  பெயர்ச்சொல் எது? ', ['மரம்', 'சமை', 'நட', 'குடி'], 0) // other wrong options, extra spaces
const nounOtherWord = choice('3', 'இவற்றில் பெயர்ச்சொல் எது?', ['சமை', 'தூங்கு', 'நட', 'நூலகம்'], 3)
ok(sameQuestionKey(nounA) === sameQuestionKey(nounSameAnswer), 'same wording and same right answer is the same question (wrong options, order and spacing aside)')
ok(sameQuestionKey(nounA) !== sameQuestionKey(nounOtherWord), 'same sentence stem about a different word is a different question')
ok(sameQuestionKey(choice('4', 'Q', ['அ', 'ஆ'], 0)) !== sameQuestionKey(choice('5', 'Q', ['அ', 'ஆ'], 1)), 'a different right answer is a different question')
const pairs = (id: string, ps: [string, string][]): Question => ({ ...base, id, kind: 'match', prompt: 'Match', pairs: ps.map(([left, right]) => ({ left, right })) })
ok(sameQuestionKey(pairs('6', [['பூனை', 'cat'], ['நாய்', 'dog']])) === sameQuestionKey(pairs('7', [['நாய்', 'dog'], ['பூனை', 'cat']])), 'the same pairs in another order are the same match board')
ok(sameQuestionKey(pairs('6', [['பூனை', 'cat'], ['நாய்', 'dog']])) !== sameQuestionKey(pairs('8', [['பூனை', 'cat'], ['பசு', 'cow']])), 'different pairs are a different board')
const word = (id: string, answer: string, prompt = 'Build the word'): Question => ({ ...base, id, kind: 'order', prompt, unit: 'letters', answer })
ok(sameQuestionKey(word('9', 'அம்மா')) === sameQuestionKey(word('10', 'அம்மா', 'Make the word for mother')), 'the same word to build is the same question')
ok(sameQuestionKey(word('9', 'அம்மா')) !== sameQuestionKey(word('11', 'அப்பா')), 'a different word is a different question')
const list = [nounA, nounOtherWord, nounSameAnswer, nounA]
ok(withoutRepeats(list).map((q) => q.id).join() === '1,3', 'repeats are left out, the first of each kept, in order')
ok(repeatsIn(list).map((q) => q.id).join() === '2,1', 'the repeats are found')
ok(withoutRepeats([]).length === 0 && repeatsIn([nounA, nounOtherWord]).length === 0, 'no repeats: nothing removed')

// ---- Topics in teaching order ----
const cases = ['எட்டாம் வேற்றுமை – விளி', 'ஆறாம் வேற்றுமை – அது / உடைய', 'முதல் வேற்றுமை – எழுவாய்', 'நான்காம் வேற்றுமை – கு', 'இரண்டாம் வேற்றுமை – ஐ', 'ஏழாம் வேற்றுமை – கண் / இல் / இடம்', 'மூன்றாம் வேற்றுமை – ஆல் / ஒடு / உடன்', 'ஐந்தாம் வேற்றுமை – இன் / இல் (நீங்கல், ஒப்பு)']
const grouped = groupTopics(['சொல் பொருள்', 'காலம்', ...cases, 'வல்லினம்', 'பெயர்ச்சொல் வகைகள்', 'திணை', 'உயிர் எழுத்துக்கள்', 'Other questions'], (n) => n, (n) => n === 'Other questions')
const sectionOf = (name: string) => grouped.find((g) => g.items.includes(name))?.section.id
ok(grouped.map((g) => g.section.id).join() === 'letters,grammar,words,cases,other', 'sections come in teaching order (empty ones left out)')
const caseOrder = grouped.find((g) => g.section.id === 'cases')!.items.map((n) => n.split(' ')[0])
ok(caseOrder.join() === 'முதல்,இரண்டாம்,மூன்றாம்,நான்காம்,ஐந்தாம்,ஆறாம்,ஏழாம்,எட்டாம்', 'the eight cases are together, முதல் to எட்டாம்')
ok(sectionOf('ஏழாம் வேற்றுமை – கண் / இல் / இடம்') === 'cases', 'a case that mentions இடம் is still a case, not the இடம் topic')
ok(grouped.find((g) => g.section.id === 'grammar')!.items.join() === 'திணை,காலம்', 'திணை, பால், எண், இடம், காலம் keep their order')
ok(sectionOf('வல்லினம்') === 'letters' && sectionOf('உயிர் எழுத்துக்கள்') === 'letters', 'letter topics are together')
ok(sectionOf('பெயர்ச்சொல் வகைகள்') === 'words', 'parts of speech are together')
ok(grouped[grouped.length - 1].items[grouped[grouped.length - 1].items.length - 1] === 'Other questions', 'questions without a topic come last')
ok(topicPlace('ஒன்பதாம் வேற்றுமை – புதிது').section === 'cases' && topicPlace('புதிய எழுத்து வகை').section === 'letters', 'a new topic joins its section by name')
ok(topicPlace('உயிர்மெய் உருவாக்கம்').section === 'letters', 'உயிர்மெய் உருவாக்கம் is a letters topic')
ok(compareTopics('உயிர்மெய் எழுத்துக்கள்', 'உயிர்மெய் உருவாக்கம்') < 0 && compareTopics('உயிர்மெய் உருவாக்கம்', 'குறில் நெடில் – எழுத்துக்கள்') < 0, 'உயிர்மெய் உருவாக்கம் comes after the உயிர்மெய் letters, before குறில் நெடில்')
ok(topicPlace('மெய்யெழுத்துகள்').section === 'letters', 'மெய்யெழுத்துகள் (joined spelling) is a letters topic')
ok(compareTopics('உயிர் எழுத்துக்கள்', 'மெய்யெழுத்துகள்') < 0 && compareTopics('மெய்யெழுத்துகள்', 'உயிர்மெய் உருவாக்கம்') < 0, 'மெய்யெழுத்துகள் comes right after உயிர் எழுத்துக்கள்')
ok(compareTopics('முதல் வேற்றுமை – எழுவாய்', 'இரண்டாம் வேற்றுமை – ஐ') < 0, 'முதல் comes before இரண்டாம்')

console.log(failures ? `${failures} FAILURE(S) of ${checks} checks.` : `PASS: ${checks} checks.`)
process.exit(failures ? 1 : 0)
