import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { auth } from '@clerk/nextjs/server'
import { ResourcesClient, type ResourceRow } from '@/components/resources/ResourcesClient'

export const dynamic = 'force-dynamic'

export default async function StudentResourcesPage() {
  const supabase = createClient()
  const admin = createAdminClient()
  const { userId } = await auth()

  const [{ data: resources }, { data: classes }] = await Promise.all([
    supabase
      .from('sms_resources')
      .select('*, class:sms_classes(id, name), uploader:sms_profiles(first_name, last_name)')
      .order('created_at', { ascending: false })
      .returns<ResourceRow[]>(),
    // Admin client: RLS otherwise scopes sms_classes to only classes this
    // student is enrolled in, but the filter dropdown should offer every
    // class resources exist for.
    admin.from('sms_classes').select('id, name').order('name'),
  ])

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">Resources</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">Files and materials shared by your teachers.</p>
      </div>

      <ResourcesClient
        initialResources={resources ?? []}
        classes={classes ?? []}
        currentProfileId={userId ?? ''}
        canUpload={false}
        canUploadAllClasses={false}
        teacherClassIds={[]}
      />
    </div>
  )
}
