import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { auth } from '@clerk/nextjs/server'
import { ResourcesClient, type ResourceRow } from '@/components/resources/ResourcesClient'
import {
  ResourceMetricsDashboard,
  type UploaderStat,
  type ClassStat,
} from '@/components/resources/ResourceMetricsDashboard'
import { getBucketTotalSize } from '@/lib/storage/bucketSize'

export const dynamic = 'force-dynamic'

export default async function AdminResourcesPage() {
  const supabase = createClient()
  const admin = createAdminClient()
  const { userId } = await auth()

  const [{ data: resources }, { data: classes }, assignmentImageStorageBytes] = await Promise.all([
    supabase
      .from('sms_resources')
      .select('*, class:sms_classes(id, name), uploader:sms_profiles(first_name, last_name)')
      .order('created_at', { ascending: false })
      .returns<ResourceRow[]>(),
    // Admin client: the filter dropdown needs every class regardless of
    // RLS's per-role scoping (same reasoning as admin/attendance).
    admin.from('sms_classes').select('id, name').order('name'),
    // Assignment images have no file_size column to SUM() -- this is the
    // only bucket that needs a real Storage listing (see bucketSize.ts).
    getBucketTotalSize('assignment-images'),
  ])

  const resourceList = resources ?? []
  const resourceStorageBytes = resourceList.reduce((sum, r) => sum + (r.file_size ?? 0), 0)

  const uploaderMap = new Map<string, UploaderStat>()
  const classMap = new Map<string, ClassStat>()
  for (const r of resourceList) {
    const size = r.file_size ?? 0

    if (r.created_by) {
      const name = r.uploader ? `${r.uploader.first_name} ${r.uploader.last_name}`.trim() : 'Unknown'
      const existing = uploaderMap.get(r.created_by)
      if (existing) {
        existing.count += 1
        existing.totalSize += size
      } else {
        uploaderMap.set(r.created_by, { profileId: r.created_by, name, count: 1, totalSize: size })
      }
    }

    const classKey = r.class_id ?? 'all'
    const className = r.class?.name ?? 'All Classes'
    const existingClass = classMap.get(classKey)
    if (existingClass) {
      existingClass.count += 1
      existingClass.totalSize += size
    } else {
      classMap.set(classKey, { classId: r.class_id, className, count: 1, totalSize: size })
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">Resources</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">
          Shared files and materials uploaded by teachers and admin.
        </p>
      </div>

      <ResourceMetricsDashboard
        resourceStorageBytes={resourceStorageBytes}
        assignmentImageStorageBytes={assignmentImageStorageBytes}
        uploaders={Array.from(uploaderMap.values())}
        classes={Array.from(classMap.values())}
      />

      <ResourcesClient
        initialResources={resourceList}
        classes={classes ?? []}
        currentProfileId={userId ?? ''}
        canUpload
        canUploadAllClasses
        teacherClassIds={[]}
      />
    </div>
  )
}
