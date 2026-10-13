// Screenshot harness for the GameRoom Classic prototype (development only;
// never part of the Next app). Mounts the real screens with sample data so
// they can be looked at in Chrome without Clerk or a database.
//   ?screen=home|teacher|create|assign|results|student|... (see SCREENS)
import { createRoot } from 'react-dom/client'
import type { ReactNode } from 'react'
import { Frame } from '@/components/grClassic/Frame'
import { Home } from '@/components/grClassic/Home'
import { TeacherDashboard } from '@/components/grClassic/teacher/TeacherDashboard'
import { CreateGameWizard } from '@/components/grClassic/teacher/CreateGameWizard'
import { AssignForm } from '@/components/grClassic/teacher/AssignForm'
import { AssignmentResults } from '@/components/grClassic/teacher/AssignmentResults'
import { StudentHome } from '@/components/grClassic/student/StudentHome'
import { AssignmentsBoard } from '@/components/grClassic/student/AssignmentsBoard'
import { AssignmentReview } from '@/components/grClassic/student/AssignmentReview'
import { GamePlayer } from '@/components/grClassic/games/GamePlayer'
import { JoinLive } from '@/components/grClassic/live/JoinLive'
import { HostLive } from '@/components/grClassic/live/HostLive'
import { assignmentById, gameById, studentAssignments } from '@/lib/grClassic/sampleData'

const g = (id: string) => gameById(id)!
const practice = (id: string) => <GamePlayer game={g(id)} mode="practice" exit={{ href: '#' }} />

export const SCREENS: Record<string, () => ReactNode> = {
  home: () => <Home />,
  teacher: () => <TeacherDashboard />,
  'teacher-pick-host': () => <TeacherDashboard pick="host" />,
  'teacher-assignments': () => <TeacherDashboard tab="assignments" />,
  create: () => <CreateGameWizard />,
  edit: () => <CreateGameWizard edit={g('g-word-builder')} />,
  assign: () => <AssignForm game={g('g-uyir-quiz')} />,
  results: () => <AssignmentResults assignment={assignmentById('a-uyir')!} game={g('g-uyir-quiz')} />,
  student: () => <StudentHome />,
  'student-assignments': () => <AssignmentsBoard />,
  review: () => <AssignmentReview a={studentAssignments().find((a) => a.assignment.id === 'a-inam')!} />,
  quiz: () => practice('g-uyir-quiz'),
  match: () => practice('g-porul-match'),
  word: () => practice('g-word-builder'),
  sentence: () => practice('g-sentence-builder'),
  'assignment-quiz': () => <GamePlayer game={g('g-uyir-quiz')} mode="assignment" assignment={{ attemptsLeftAfter: 1, showScore: true, randomize: false, dueAt: assignmentById('a-uyir')!.dueAt }} exit={{ href: '#' }} />,
  join: () => <JoinLive />,
  host: () => <HostLive game={g('g-uyir-quiz')} />,
  'host-race': () => <HostLive game={g('g-porul-match')} />,
}

const screen = new URLSearchParams(location.search).get('screen') ?? 'home'
createRoot(document.getElementById('root')!).render(<Frame>{(SCREENS[screen] ?? SCREENS.home)()}</Frame>)
