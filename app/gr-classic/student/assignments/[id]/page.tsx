import { notFound } from 'next/navigation'
import { AssignmentReview } from '@/components/grClassic/student/AssignmentReview'
import { studentAssignments } from '@/lib/grClassic/sampleData'

export default function GrClassicAssignmentReviewPage({ params }: { params: { id: string } }) {
  const a = studentAssignments().find((x) => x.assignment.id === params.id && x.status === 'submitted')
  if (!a) notFound()
  return <AssignmentReview a={a} />
}
