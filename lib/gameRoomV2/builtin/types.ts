import type { GameRoomQuestionType, QuestionSetDifficulty } from '../domain'

// Built-in Tamil content is authored here, in code, and synced into the
// SAME sms_gamev2_question_sets / sms_gamev2_questions tables teacher
// content lives in (see sync.ts). There is no parallel content engine:
// once synced, a built-in set is an ordinary published PUBLIC question set
// that every existing engine, session, Live Classroom and analytics path
// already understands. What makes it "built-in" is only that its id is a
// deterministic id from this catalog (ids.ts).

export type BuiltinSetKind = 'quiz' | 'sort' | 'match' | 'order'

export interface BuiltinQuestion {
  questionType: GameRoomQuestionType
  prompt: string
  payload: Record<string, unknown>
  explanation?: string
}

export interface BuiltinSetDef {
  kind: BuiltinSetKind
  // Shown to teachers in the library; students see the topic, not the set.
  title: string
  questions: BuiltinQuestion[]
}

export type TopicCategory = 'letters' | 'sounds' | 'vocabulary' | 'grammar' | 'reading' | 'sentences' | 'everyday' | 'challenge'

export interface BuiltinTopicDef {
  key: string
  tamilTitle: string
  englishTitle: string
  description: string
  category: TopicCategory
  difficulty: QuestionSetDifficulty
  // NILAI level, same GRADE_LEVEL_OPTIONS values as the rest of the app.
  level: string | null
  sets: BuiltinSetDef[]
}

export interface BuiltinSet extends BuiltinSetDef {
  id: string
  topicKey: string
  questionTypes: GameRoomQuestionType[]
  questionIds: string[]
}

export interface BuiltinTopic extends Omit<BuiltinTopicDef, 'sets'> {
  sets: BuiltinSet[]
}

export interface LearningBoard {
  id: string
  title: string
  tamilTitle: string
  description: string
  topicKeys: string[]
}
