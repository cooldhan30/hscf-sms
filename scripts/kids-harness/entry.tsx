// Browser harness for the Little Learners games (development only; never
// part of the Next app or the production build). Mounts the REAL game
// component with an in-page stand-in for the session API, so the game can
// be played and screenshotted in Chromium without a login or a database.
// The stand-in only mimics the API's shape; real grading stays on the server.
//
//   node scripts/kids-harness/build.mjs && open the printed file
//   ?engine=balloon-pop  ?set=vowels|mixed  ?wrong=1 (every answer graded wrong)
import { createRoot } from 'react-dom/client'
import type { ComponentType } from 'react'
import { BalloonPopGame } from '@/components/gameRoomV2/balloonPop/BalloonPopGame'
import { LetterTrainGame } from '@/components/gameRoomV2/letterTrain/LetterTrainGame'
import { ParachuteCatchGame } from '@/components/gameRoomV2/parachuteCatch/ParachuteCatchGame'
import { FishingPondGame } from '@/components/gameRoomV2/fishingPond/FishingPondGame'
import { MissingLetterGame } from '@/components/gameRoomV2/missingLetter/MissingLetterGame'
import { LetterParadeGame } from '@/components/gameRoomV2/letterParade/LetterParadeGame'
import { FrogJumpGame } from '@/components/gameRoomV2/frogJump/FrogJumpGame'
import { BusyBeeGame } from '@/components/gameRoomV2/busyBee/BusyBeeGame'
import { DinosaurEggGame } from '@/components/gameRoomV2/dinosaurEgg/DinosaurEggGame'
import { IceCreamShopGame } from '@/components/gameRoomV2/iceCreamShop/IceCreamShopGame'
import { TreasureHuntGame } from '@/components/gameRoomV2/treasureHunt/TreasureHuntGame'
import { BuildAHouseGame } from '@/components/gameRoomV2/buildAHouse/BuildAHouseGame'
import { SortBasketsGame } from '@/components/gameRoomV2/sortBaskets/SortBasketsGame'
import { ListenChooseGame } from '@/components/gameRoomV2/listenChoose/ListenChooseGame'
import { TraceLearn } from '@/components/gameRoomV2/trace/TraceLearn'

type Q = { type: string; prompt: string; payload: Record<string, unknown>; answer: string | boolean; reveal: string }

// The built-in உயிரெழுத்துகள் quiz (lib/gameRoomV2/builtin/content/letters.ts)
const VOWELS: Q[] = [
  { type: 'MULTIPLE_CHOICE', prompt: 'தமிழின் முதல் எழுத்து எது? (Which is the first Tamil letter?)', payload: { options: ['க', 'அ', 'ஃ', 'ஔ'] }, answer: 'அ', reveal: 'அ' },
  { type: 'MULTIPLE_CHOICE', prompt: 'அ, ஆ, இ, ___ -- அடுத்த உயிரெழுத்து எது?', payload: { options: ['உ', 'எ', 'ஈ', 'ஐ'] }, answer: 'ஈ', reveal: 'ஈ' },
  { type: 'MULTIPLE_CHOICE', prompt: '"ஆடு" என்ற சொல் எந்த எழுத்தில் தொடங்குகிறது?', payload: { options: ['அ', 'ஔ', 'ஆ', 'ஓ'] }, answer: 'ஆ', reveal: 'ஆ' },
  { type: 'MULTIPLE_CHOICE', prompt: 'இவற்றுள் உயிரெழுத்து எது? (Which one is a vowel?)', payload: { options: ['க்', 'ஏ', 'ம', 'ஃ'] }, answer: 'ஏ', reveal: 'ஏ' },
  { type: 'MULTIPLE_CHOICE', prompt: '"ஐ" எந்த வகை எழுத்து?', payload: { options: ['மெய்யெழுத்து', 'உயிரெழுத்து', 'உயிர்மெய்யெழுத்து', 'ஆய்த எழுத்து'] }, answer: 'உயிரெழுத்து', reveal: 'உயிரெழுத்து' },
  { type: 'TRUE_FALSE', prompt: 'உயிரெழுத்துகள் 12. (There are 12 vowels.)', payload: {}, answer: true, reveal: 'True' },
]

// The built-in "Put the vowels / consonants in order" sets, plus a sentence
const ORDER: Q[] = [
  { type: 'ORDER_LETTERS', prompt: 'உயிரெழுத்துகளை வரிசைப்படுத்துக (Put the vowels in order)', payload: { letters: ['இ', 'அ', 'ஈ', 'ஆ'] }, answer: 'அஆஇஈ', reveal: 'அஆஇஈ' },
  { type: 'ORDER_LETTERS', prompt: 'உயிரெழுத்துகளை வரிசைப்படுத்துக (Put the vowels in order)', payload: { letters: ['ஔ', 'ஒ', 'ஐ', 'ஓ'] }, answer: 'ஐஒஓஔ', reveal: 'ஐஒஓஔ' },
  { type: 'ORDER_LETTERS', prompt: 'மெய்யெழுத்துகளை வரிசைப்படுத்துக (Put the consonants in order)', payload: { letters: ['ங்', 'க்', 'ஞ்', 'ச்'] }, answer: 'க்ங்ச்ஞ்', reveal: 'க்ங்ச்ஞ்' },
  { type: 'ORDER_LETTERS', prompt: 'உயிரெழுத்துகளை வரிசைப்படுத்துக (Put the vowels in order)', payload: { letters: ['எ', 'இ', 'ஊ', 'உ', 'ஈ'] }, answer: 'இஈஉஊஎ', reveal: 'இஈஉஊஎ' },
  { type: 'ORDER_WORDS', prompt: 'சொற்களை வரிசைப்படுத்தி வாக்கியம் அமை (Make the sentence)', payload: { words: ['செல்கிறேன்', 'நான்', 'பள்ளிக்குச்'] }, answer: 'நான் பள்ளிக்குச் செல்கிறேன்', reveal: 'நான் பள்ளிக்குச் செல்கிறேன்' },
]

// The built-in grammar/letter sorting sets (CATEGORIZE); reveal is "item: basket, ..."
const SORT: Q[] = [
  {
    type: 'CATEGORIZE',
    prompt: 'உயர்திணையா அஃறிணையா? வகைப்படுத்துக',
    payload: { items: ['மனிதன்', 'நாய்', 'அம்மா', 'மரம்', 'ஆசிரியர்', 'வீடு'], categories: ['உயர்திணை', 'அஃறிணை'] },
    answer: JSON.stringify({ மனிதன்: 'உயர்திணை', நாய்: 'அஃறிணை', அம்மா: 'உயர்திணை', மரம்: 'அஃறிணை', ஆசிரியர்: 'உயர்திணை', வீடு: 'அஃறிணை' }),
    reveal: 'மனிதன்: உயர்திணை, அம்மா: உயர்திணை, ஆசிரியர்: உயர்திணை, நாய்: அஃறிணை, மரம்: அஃறிணை, வீடு: அஃறிணை',
  },
  {
    type: 'CATEGORIZE',
    prompt: 'உயிரா மெய்யா? வகைப்படுத்துக (Vowel or consonant?)',
    payload: { items: ['அ', 'க்', 'இ', 'ம்'], categories: ['உயிர்', 'மெய்'] },
    answer: JSON.stringify({ அ: 'உயிர்', 'க்': 'மெய்', இ: 'உயிர்', 'ம்': 'மெய்' }),
    reveal: 'அ: உயிர், இ: உயிர், க்: மெய், ம்: மெய்',
  },
  {
    type: 'CATEGORIZE',
    prompt: 'எந்தப் பால்? வகைப்படுத்துக',
    payload: { items: ['அவன்', 'அவள்', 'அவர்கள்', 'தம்பி', 'அக்கா', 'மக்கள்'], categories: ['ஆண்பால்', 'பெண்பால்', 'பலர்பால்'] },
    answer: JSON.stringify({ அவன்: 'ஆண்பால்', அவள்: 'பெண்பால்', அவர்கள்: 'பலர்பால்', தம்பி: 'ஆண்பால்', அக்கா: 'பெண்பால்', மக்கள்: 'பலர்பால்' }),
    reveal: 'அவன்: ஆண்பால், தம்பி: ஆண்பால், அவள்: பெண்பால், அக்கா: பெண்பால், அவர்கள்: பலர்பால், மக்கள்: பலர்பால்',
  },
]
// Listen & Choose plays no true/false: the last question is a choice with the same labels
const LISTEN: Q[] = [
  ...VOWELS.slice(0, 5),
  { type: 'MULTIPLE_CHOICE', prompt: 'உயிரெழுத்துகள் 12. (There are 12 vowels.)', payload: { options: ['சரி ✓', 'தவறு ✗'] }, answer: 'சரி ✓', reveal: 'சரி ✓' },
]

const params = new URLSearchParams(location.search)
const ENGINE_ID = params.get('engine') ?? 'balloon-pop'
const QUESTIONS = ENGINE_ID === 'letter-parade' ? ORDER : ENGINE_ID === 'sort-baskets' ? SORT : ENGINE_ID === 'listen-choose' ? LISTEN : VOWELS
const autoWrong = params.get('wrong') === '1'
const session = { status: 'ACTIVE' as string, currentIndex: Number(params.get('start') ?? 0), correct: 0 }
;(window as unknown as { __harness: unknown }).__harness = { session, QUESTIONS }

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
const realFetch = window.fetch.bind(window)
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const m = url.match(/\/api\/gameroom-v2\/sessions\/[^/]+\/(\w+)/)
  if (!m) return realFetch(input, init)
  const action = m[1]
  const total = QUESTIONS.length
  if (action === 'answer') {
    const body = JSON.parse(String(init?.body ?? '{}')) as { questionIndex: number; answer: string | boolean | string[] | Record<string, string> }
    const q = QUESTIONS[body.questionIndex]
    // Ordering answers arrive as arrays, sorting as { item: basket }
    const given = Array.isArray(body.answer)
      ? (body.answer as string[]).join(q.type === 'ORDER_WORDS' ? ' ' : '')
      : body.answer && typeof body.answer === 'object'
        ? JSON.stringify(JSON.parse(q.answer as string), Object.keys(JSON.parse(q.answer as string))) ===
          JSON.stringify(body.answer, Object.keys(JSON.parse(q.answer as string)))
          ? q.answer
          : 'wrong'
        : body.answer
    const correct = !autoWrong && given === q.answer
    if (correct) session.correct++
    session.currentIndex = Math.min(total, session.currentIndex + 1)
    if (session.currentIndex >= total) session.status = 'COMPLETED'
    return json({ isCorrect: correct, points: correct ? 1000 : 0, xpEarned: correct ? 10 : 0, coinsEarned: correct ? 2 : 0, correctAnswer: correct ? null : q.reveal, explanation: null, completed: session.status === 'COMPLETED' })
  }
  if (action === 'complete') {
    return json({ sessionId: 'harness', score: session.correct * 1000, accuracyPct: Math.round((session.correct / total) * 100), correctCount: session.correct, incorrectCount: total - session.correct, totalQuestions: total, xpEarned: session.correct * 12, coinsEarned: session.correct * 2, bestStreak: session.correct, skillsPracticed: ['உயிரெழுத்துகள்'], newlyEarnedAchievementIds: [] })
  }
  if (action === 'abandon') return json({ ok: true })
  // Stand-in for Sarvam TTS: any short sound from the app's public folder
  if (action === 'listen') return json({ url: '/tamizhi/sounds/correct.wav' })
  const q = session.status === 'ACTIVE' && session.currentIndex < total ? QUESTIONS[session.currentIndex] : null
  return json({
    status: session.status,
    engineId: params.get('engine') ?? 'balloon-pop',
    currentIndex: session.currentIndex,
    totalQuestions: total,
    remainingSeconds: q ? 30 : null,
    question: q ? { id: `q${session.currentIndex}`, questionType: q.type, prompt: q.prompt, payload: q.payload, mediaUrl: null, points: 10 } : null,
  })
}

const ENGINES: Record<string, ComponentType<{ sessionId: string; onExit: () => void; onPlayAgain?: () => void; onHome?: () => void }>> = {
  'balloon-pop': BalloonPopGame,
  'letter-train': LetterTrainGame,
  'parachute-catch': ParachuteCatchGame,
  'fishing-pond': FishingPondGame,
  'missing-letter': MissingLetterGame,
  'letter-parade': LetterParadeGame,
  'frog-jump': FrogJumpGame,
  'busy-bee': BusyBeeGame,
  'dinosaur-egg': DinosaurEggGame,
  'ice-cream-shop': IceCreamShopGame,
  'treasure-hunt': TreasureHuntGame,
  'build-a-house': BuildAHouseGame,
  'sort-baskets': SortBasketsGame,
  'listen-choose': ListenChooseGame,
  trace: TraceLearn as unknown as ComponentType<{ sessionId: string; onExit: () => void }>,
}
const Engine = ENGINES[params.get('engine') ?? 'balloon-pop']
const root = createRoot(document.getElementById('root') as HTMLElement)
root.render(<Engine sessionId="harness" onExit={() => location.reload()} onPlayAgain={() => location.reload()} onHome={() => location.reload()} />)
