import { createAdminClient } from '@/lib/supabase/admin'
import { getBucketTotalSize } from '@/lib/storage/bucketSize'
import { StorageReportClient, type ClassStorageRow, type TeacherStorageRow } from './StorageReportClient'

export const dynamic = 'force-dynamic'

type ResourceRow = {
  file_size: number | null
  class_id: string | null
  created_by: string | null
  class: { name: string } | null
  uploader: { first_name: string; last_name: string } | null
}

type AssignmentRow = {
  id: string
  image_size: number | null
  class_id: string | null
  class: { name: string } | null
}

type SubmissionRow = {
  file_size: number | null
  audio_size: number | null
  assignment_id: string
}

export default async function StorageReportPage() {
  const admin = createAdminClient()

  const [{ data: resources }, { data: assignments }, { data: submissions }, assignmentImageBucketBytes] =
    await Promise.all([
      admin
        .from('sms_resources')
        .select('file_size, class_id, created_by, class:sms_classes(name), uploader:sms_profiles(first_name, last_name)')
        .returns<ResourceRow[]>(),
      admin.from('sms_assignments').select('id, image_size, class_id, class:sms_classes(name)').returns<AssignmentRow[]>(),
      admin.from('sms_submissions').select('file_size, audio_size, assignment_id').returns<SubmissionRow[]>(),
      // Assignment images have no size column on their own table -- only
      // ones created after 045 do (image_size). Older rows are covered by
      // listing the bucket directly, same as the Resources dashboard.
      getBucketTotalSize('assignment-images'),
    ])

  const resourceList = resources ?? []
  const resourceBytes = resourceList.reduce((sum, r) => sum + (r.file_size ?? 0), 0)

  const assignmentList = assignments ?? []
  const trackedImageBytes = assignmentList.reduce((sum, a) => sum + (a.image_size ?? 0), 0)
  // Rows created before migration 045 have image_size = NULL, so the
  // tracked sum will always undercount the real bucket total -- use
  // whichever is larger as the best available estimate.
  const assignmentImageBytes = Math.max(trackedImageBytes, assignmentImageBucketBytes)

  const submissionBytes = (submissions ?? []).reduce((sum, s) => sum + (s.file_size ?? 0) + (s.audio_size ?? 0), 0)

  const submissionBytesByAssignment = new Map<string, number>()
  for (const s of submissions ?? []) {
    const total = (s.file_size ?? 0) + (s.audio_size ?? 0)
    submissionBytesByAssignment.set(s.assignment_id, (submissionBytesByAssignment.get(s.assignment_id) ?? 0) + total)
  }

  const classMap = new Map<string, ClassStorageRow>()
  for (const r of resourceList) {
    const key = r.class_id ?? 'all'
    const name = r.class?.name ?? 'All Classes'
    const existing = classMap.get(key)
    if (existing) existing.resourceBytes += r.file_size ?? 0
    else classMap.set(key, { classId: key, className: name, resourceBytes: r.file_size ?? 0, assignmentBytes: 0 })
  }
  for (const a of assignmentList) {
    const key = a.class_id ?? 'all'
    const name = a.class?.name ?? 'All Classes'
    const bytes = (a.image_size ?? 0) + (submissionBytesByAssignment.get(a.id) ?? 0)
    const existing = classMap.get(key)
    if (existing) existing.assignmentBytes += bytes
    else classMap.set(key, { classId: key, className: name, resourceBytes: 0, assignmentBytes: bytes })
  }

  const teacherMap = new Map<string, TeacherStorageRow>()
  for (const r of resourceList) {
    if (!r.created_by) continue
    const name = r.uploader ? `${r.uploader.first_name} ${r.uploader.last_name}`.trim() : 'Unknown'
    const existing = teacherMap.get(r.created_by)
    if (existing) existing.totalBytes += r.file_size ?? 0
    else teacherMap.set(r.created_by, { profileId: r.created_by, name, totalBytes: r.file_size ?? 0 })
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">Storage Usage Details</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">
          Total storage used across resources, assignment images, and student submissions.
        </p>
      </div>

      <StorageReportClient
        resourceBytes={resourceBytes}
        assignmentImageBytes={assignmentImageBytes}
        submissionBytes={submissionBytes}
        classes={Array.from(classMap.values())}
        uploaders={Array.from(teacherMap.values())}
      />
    </div>
  )
}
