import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { auth } from '@clerk/nextjs/server'
import { ResourcesClient, type ResourceRow } from '@/components/resources/ResourcesClient'

export const dynamic = 'force-dynamic'

export default async function TeacherResourcesPage() {
  const supabase = createClient()
  const admin = createAdminClient()
  const { userId } = await auth()

  const { data: teacher } = await supabase.from('sms_teachers').select('id').eq('profile_id', userId ?? '').single()

  const [{ data: resources }, { data: classes }, { data: myClassLinks }] = await Promise.all([
    supabase
      .from('sms_resources')
      .select('*, class:sms_classes(id, name), uploader:sms_profiles(first_name, last_name)')
      .order('created_at', { ascending: false })
      .returns<ResourceRow[]>(),
    // Admin client: teachers need to browse ALL classes' resources, not
    // just their own (RLS otherwise scopes "classes: teacher read own").
    admin.from('sms_classes').select('id, name').order('name'),
    teacher
      ? supabase.from('sms_class_teachers').select('class_id').eq('teacher_id', teacher.id)
      : Promise.resolve({ data: [] as { class_id: string }[] }),
  ])

  const teacherClassIds = (myClassLinks ?? []).map((l) => l.class_id)

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">Resources</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">
          Shared files and materials for your classes -- upload your own, or browse what other teachers have shared.
        </p>
      </div>

      <ResourcesClient
        initialResources={resources ?? []}
        classes={classes ?? []}
        currentProfileId={userId ?? ''}
        canUpload
        canUploadAllClasses={false}
        teacherClassIds={teacherClassIds}
        canAssign
        canEditAny
      />
    </div>
  )
}
