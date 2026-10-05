// Serializable data for the GameRoom home launcher (GameLauncher.tsx),
// built on the server by app/gameroom-v2/home/launcherData.ts. Titles,
// counts and which game plays which set -- never questions or answers.

export interface LauncherGame {
  id: string
  name: string
  tamilName: string | null
  description: string
  // Little Learners (ages 4-9): untimed by design, so the time choice
  // doesn't apply to them.
  kids: boolean
}

export interface LauncherTopic {
  key: string
  title: string
  tamilTitle: string | null
  // Heading the topic is listed under ("Letters", "From your teacher", ...)
  group: string
  // Teacher-made sets are listed first
  custom: boolean
  games: { engineId: string; setId: string; questionCount: number }[]
}

export interface LauncherClass {
  id: string
  name: string
  gradeLevel: string | null
}

export interface MyQuestionSet {
  id: string
  title: string
  tamilTitle: string | null
  questionCount: number
}

export interface LauncherProps {
  role: 'student' | 'teacher'
  firstName: string
  topics: LauncherTopic[]
  games: LauncherGame[]
  // Teachers only
  classes: LauncherClass[]
  mySets: MyQuestionSet[]
}
