import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { auth } from '@clerk/nextjs/server'
import { ResourcesClient, type ResourceRow } from '@/components/resources/ResourcesClient'

export const dynamic = 'force-dynamic'

export default async function AdminResourcesPage() {
  const supabase = createClient()
  const admin = createAdminClient()
  const { userId } = await auth()

  const [{ data: resources }, { data: classes }] = await Promise.all([
    supabase
      .from('sms_resources')
      .select('*, class:sms_classes(id, name), uploader:sms_profiles(first_name, last_name)')
      .order('created_at', { ascending: false })
      .returns<ResourceRow[]>(),
    // Admin client: the filter dropdown needs every class regardless of
    // RLS's per-role scoping (same reasoning as admin/attendance).
    admin.from('sms_classes').select('id, name').order('name'),
  ])

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">Resources</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">
          Shared files and materials uploaded by teachers and admin.
        </p>
      </div>

      <ResourcesClient
        initialResources={resources ?? []}
        classes={classes ?? []}
        currentProfileId={userId ?? ''}
        canUpload
        canUploadAllClasses
        teacherClassIds={[]}
      />
    </div>
  )
}
