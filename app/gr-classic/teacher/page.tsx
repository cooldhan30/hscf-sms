import { TeacherDashboard } from '@/components/grClassic/teacher/TeacherDashboard'

export default function GrClassicTeacherPage({ searchParams }: { searchParams: { pick?: string; tab?: string } }) {
  const pick = searchParams.pick === 'host' || searchParams.pick === 'assign' ? searchParams.pick : undefined
  return <TeacherDashboard pick={pick} tab={searchParams.tab === 'assignments' ? 'assignments' : 'games'} />
}
