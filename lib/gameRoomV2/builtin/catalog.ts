import { getGameEngineV2 } from '../registry'
import { gameAvailability, isEngineLaunchable, launchableEngines } from '../gameAvailability'
import type { GameEngine, GameRoomQuestionType } from '../domain'
import { builtinUuid, sha1Hex } from './ids'
import type { BuiltinQuestion, BuiltinSet, BuiltinSetKind, BuiltinTopic, BuiltinTopicDef, LearningBoard } from './types'
import { LETTER_TOPICS } from './content/letters'
import { SOUND_TOPICS } from './content/sounds'
import { VOCABULARY_TOPICS } from './content/vocabulary'
import { GRAMMAR_TOPICS } from './content/grammar'
import { READING_TOPICS, SENTENCE_TOPICS, EVERYDAY_EXTRA_TOPICS } from './content/reading'

// ---------------------------------------------------------------------
// Tamil Challenge topics: harder mixed review, built from every Nth
// question of the source topics' quiz sets (so they are always in sync
// with -- and exactly as validated as -- the source content).
// ---------------------------------------------------------------------
function sampleQuiz(topics: BuiltinTopicDef[], every: number, offset: number): BuiltinQuestion[] {
  const pool = topics.flatMap((t) => t.sets.filter((s) => s.kind === 'quiz').flatMap((s) => s.questions))
  return pool.filter((_, i) => i % every === offset)
}

const CHALLENGE_TOPICS: BuiltinTopicDef[] = [
  {
    key: 'ezhuthu-savaal',
    tamilTitle: 'எழுத்துச் சவால்',
    englishTitle: 'Letters Challenge',
    description: 'Mixed review across every letter and sound topic.',
    category: 'challenge',
    difficulty: 'hard',
    level: 'grade-1',
    sets: [{ kind: 'quiz', title: 'எழுத்துச் சவால் -- Mixed Quiz', questions: sampleQuiz([...LETTER_TOPICS, ...SOUND_TOPICS], 5, 2) }],
  },
  {
    key: 'sol-savaal',
    tamilTitle: 'சொல் சவால்',
    englishTitle: 'Vocabulary Challenge',
    description: 'Mixed review across every vocabulary topic.',
    category: 'challenge',
    difficulty: 'hard',
    level: 'grade-1',
    sets: [{ kind: 'quiz', title: 'சொல் சவால் -- Mixed Quiz', questions: sampleQuiz(VOCABULARY_TOPICS, 9, 4) }],
  },
  {
    key: 'ilakkana-savaal',
    tamilTitle: 'இலக்கணச் சவால்',
    englishTitle: 'Grammar Challenge',
    description: 'Mixed திணை, பால், எண், காலம், இடம் review.',
    category: 'challenge',
    difficulty: 'hard',
    level: 'grade-2',
    sets: [{ kind: 'quiz', title: 'இலக்கணச் சவால் -- Mixed Quiz', questions: [...sampleQuiz(GRAMMAR_TOPICS, 3, 1), ...sampleQuiz(SENTENCE_TOPICS, 3, 0)] }],
  },
]

const TOPIC_DEFS: BuiltinTopicDef[] = [
  ...LETTER_TOPICS,
  ...SOUND_TOPICS,
  ...VOCABULARY_TOPICS,
  ...EVERYDAY_EXTRA_TOPICS,
  ...GRAMMAR_TOPICS,
  ...READING_TOPICS,
  ...SENTENCE_TOPICS,
  ...CHALLENGE_TOPICS,
]

function questionIdentity(q: BuiltinQuestion): string {
  return `${q.questionType}|${q.prompt}|${JSON.stringify(q.payload)}`
}

function buildTopic(def: BuiltinTopicDef): BuiltinTopic {
  return {
    ...def,
    sets: def.sets.map((s): BuiltinSet => {
      const id = builtinUuid(`set:${def.key}:${s.kind}`)
      return {
        ...s,
        id,
        topicKey: def.key,
        questionTypes: Array.from(new Set(s.questions.map((q) => q.questionType))) as GameRoomQuestionType[],
        questionIds: s.questions.map((q) => builtinUuid(`question:${id}:${questionIdentity(q)}`)),
      }
    }),
  }
}

export const BUILTIN_TOPICS: BuiltinTopic[] = TOPIC_DEFS.map(buildTopic)

export const LEARNING_BOARDS: LearningBoard[] = [
  {
    id: 'tamil-foundations',
    title: 'Tamil Foundations',
    tamilTitle: 'தமிழ் அடிப்படை',
    description: 'Start here: every Tamil letter and how it sounds.',
    topicKeys: ['uyir-ezhuthukkal', 'mei-ezhuthukkal', 'uyirmei-ezhuthukkal', 'aaytha-ezhuthu', 'kuril-nedil', 'vallinam-mellinam-idaiyinam'],
  },
  {
    id: 'letters-and-sounds',
    title: 'Letters & Sounds',
    tamilTitle: 'எழுத்தும் ஒலியும்',
    description: 'Short and long vowels, and the three consonant groups.',
    topicKeys: ['kuril', 'nedil', 'kuril-nedil', 'vallinam', 'mellinam', 'idaiyinam', 'vallinam-mellinam-idaiyinam'],
  },
  {
    id: 'vocabulary',
    title: 'Vocabulary',
    tamilTitle: 'சொல்வளம்',
    description: 'Words for the world around you.',
    topicKeys: ['udal-uruppugal', 'vilangugal', 'paravaigal', 'pazhangal', 'kaaykarigal', 'nirangal', 'enngal', 'iyarkai'],
  },
  {
    id: 'grammar',
    title: 'Grammar',
    tamilTitle: 'இலக்கணம்',
    description: 'திணை, பால், எண், காலம், இடம்.',
    topicKeys: ['thinai', 'paal', 'enn', 'kaalam', 'idam'],
  },
  {
    id: 'reading-practice',
    title: 'Reading Practice',
    tamilTitle: 'படித்தல் பயிற்சி',
    description: 'Read words and sentences, and spell them yourself.',
    topicKeys: ['sol-padithal', 'ezhuthu-kootal', 'vakkiyam-padithal'],
  },
  {
    id: 'sentence-building',
    title: 'Sentence Building',
    tamilTitle: 'வாக்கிய அமைப்பு',
    description: 'Put words in order and pick the right verb.',
    topicKeys: ['vakkiyam-amaithal', 'sariyana-sol', 'kaalam', 'idam'],
  },
  {
    id: 'everyday-tamil',
    title: 'Everyday Tamil',
    tamilTitle: 'அன்றாடத் தமிழ்',
    description: 'Family, school, home, food, jobs and getting around.',
    topicKeys: ['anraada-pechu', 'kudumbam', 'palli', 'veedu', 'unavu', 'thozhilgal', 'pokkuvarathu'],
  },
  {
    id: 'tamil-challenge',
    title: 'Tamil Challenge',
    tamilTitle: 'தமிழ்ச் சவால்',
    description: 'Harder mixed review once you know the basics.',
    topicKeys: ['ezhuthu-savaal', 'sol-savaal', 'ilakkana-savaal'],
  },
]

const TOPIC_BY_KEY = new Map(BUILTIN_TOPICS.map((t) => [t.key, t]))
const SET_BY_ID = new Map(BUILTIN_TOPICS.flatMap((t) => t.sets.map((s) => [s.id, s] as const)))

export function getBuiltinTopic(key: string): BuiltinTopic | undefined {
  return TOPIC_BY_KEY.get(key)
}

export function getBuiltinSet(id: string): BuiltinSet | undefined {
  return SET_BY_ID.get(id)
}

export function isBuiltinSetId(id: string): boolean {
  return SET_BY_ID.has(id)
}

export function topicForSetId(id: string): BuiltinTopic | undefined {
  const set = SET_BY_ID.get(id)
  return set ? TOPIC_BY_KEY.get(set.topicKey) : undefined
}

export function getLearningBoard(id: string): LearningBoard | undefined {
  return LEARNING_BOARDS.find((b) => b.id === id)
}

export const BUILTIN_SET_IDS: string[] = Array.from(SET_BY_ID.keys())

// Changes whenever any built-in content changes -- sync.ts stores it on
// each synced set so a deploy with new/edited content re-syncs exactly
// once, and an unchanged deploy does a single cheap read.
export const BUILTIN_CONTENT_VERSION = sha1Hex(JSON.stringify(BUILTIN_TOPICS)).slice(0, 12)

// ---------------------------------------------------------------------
// Topic -> Game
// ---------------------------------------------------------------------

// Which kind of set an engine should play when a topic has several.
// Engines not listed fall back to the first compatible set in topic order.
const ENGINE_SET_PREFERENCE: Record<string, BuiltinSetKind[]> = {
  'classic-quiz': ['quiz'],
  'boss-battle': ['quiz'],
  'word-ninja': ['sort'],
  matching: ['match'],
  memory: ['match'],
  racing: ['order', 'quiz'],
  'tower-defense': ['quiz', 'sort'],
  'treasure-quest': ['quiz', 'match', 'sort'],
  'kingdom-builder': ['quiz', 'match', 'sort'],
  'balloon-pop': ['quiz'],
}

// Built-in sets use the exact same availability rule as teacher-made
// and imported sets (lib/gameRoomV2/gameAvailability.ts).
function engineSupports(engine: GameEngine, set: BuiltinSet): boolean {
  return gameAvailability(engine, set.questionTypes).playable
}

export function setForEngine(topic: BuiltinTopic, engineId: string): BuiltinSet | undefined {
  const engine = getGameEngineV2(engineId)
  if (!engine || !isEngineLaunchable(engine)) return undefined
  const compatible = topic.sets.filter((s) => engineSupports(engine, s))
  const preference = ENGINE_SET_PREFERENCE[engineId] ?? []
  for (const kind of preference) {
    const found = compatible.find((s) => s.kind === kind)
    if (found) return found
  }
  return compatible[0]
}

// Every playable engine that can play at least one of the topic's sets,
// in registry order, each paired with the set it would play.
export function enginesForTopic(topic: BuiltinTopic): { engine: GameEngine; set: BuiltinSet }[] {
  return launchableEngines()
    .map((engine) => ({ engine, set: setForEngine(topic, engine.id) }))
    .filter((e): e is { engine: GameEngine; set: BuiltinSet } => Boolean(e.set))
}

// Active games that can't play ANY of the topic's sets -- shown disabled
// with their reason rather than silently missing from the topic.
export function unavailableEnginesForTopic(topic: BuiltinTopic): GameEngine[] {
  return launchableEngines().filter((engine) => !setForEngine(topic, engine.id))
}
