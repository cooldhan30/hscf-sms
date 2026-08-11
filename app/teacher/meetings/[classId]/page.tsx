import { ClassMeetingPage } from '@/components/meetings/ClassMeetingPage'

export const dynamic = 'force-dynamic'

export default function Page({ params }: { params: { classId: string } }) {
  return <ClassMeetingPage classId={params.classId} />
}
