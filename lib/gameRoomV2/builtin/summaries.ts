import { BUILTIN_TOPICS, LEARNING_BOARDS, enginesForTopic, getBuiltinTopic } from './catalog'
import type { BuiltinSetKind, BuiltinTopic, TopicCategory } from './types'

// Serializable views of the catalog for client components -- ids, titles
// and which engine plays which set; never question content or answers.

export interface EngineOption {
  engineId: string
  name: string
  description: string
  setId: string
  setKind: BuiltinSetKind
  questionCount: number
  minutes: number
  live: boolean
}

export interface TopicSummary {
  key: string
  tamilTitle: string
  englishTitle: string
  description: string
  category: TopicCategory
  difficulty: 'easy' | 'medium' | 'hard'
  questionCount: number
  engines: EngineOption[]
}

export function summarizeTopic(topic: BuiltinTopic): TopicSummary {
  return {
    key: topic.key,
    tamilTitle: topic.tamilTitle,
    englishTitle: topic.englishTitle,
    description: topic.description,
    category: topic.category,
    difficulty: topic.difficulty,
    questionCount: topic.sets.reduce((n, s) => n + s.questions.length, 0),
    engines: enginesForTopic(topic).map(({ engine, set }) => ({
      engineId: engine.id,
      name: engine.name,
      description: engine.description,
      setId: set.id,
      setKind: set.kind,
      questionCount: set.questions.length,
      minutes: engine.estimatedDurationMinutes ?? 5,
      live: engine.compatibility.liveClassroomSupport,
    })),
  }
}

export function allTopicSummaries(): TopicSummary[] {
  return BUILTIN_TOPICS.map(summarizeTopic)
}

export function topicSummary(key: string): TopicSummary | null {
  const topic = getBuiltinTopic(key)
  return topic ? summarizeTopic(topic) : null
}

export const CATEGORY_LABELS: Record<TopicCategory, string> = {
  letters: 'Letters',
  sounds: 'Sounds',
  vocabulary: 'Vocabulary',
  grammar: 'Grammar',
  reading: 'Reading',
  sentences: 'Sentences',
  everyday: 'Everyday Tamil',
  challenge: 'Challenge',
}

export { LEARNING_BOARDS }
