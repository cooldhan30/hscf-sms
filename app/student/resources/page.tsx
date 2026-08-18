import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { auth } from '@clerk/nextjs/server'
import { ResourcesClient, type ResourceRow } from '@/components/resources/ResourcesClient'

export const dynamic = 'force-dynamic'

export default async function StudentResourcesPage() {
  const supabase = createClient()
  const admin = createAdminClient()
  const { userId } = await auth()

  const { data: student } = await supabase.from('sms_students').select('id').eq('profile_id', userId ?? '').single()

  const [{ data: resources }, { data: classes }, { data: assignments }] = await Promise.all([
    supabase
      .from('sms_resources')
      .select('*, class:sms_classes(id, name), uploader:sms_profiles(first_name, last_name)')
      .order('created_at', { ascending: false })
      .returns<ResourceRow[]>(),
    // Admin client: RLS otherwise scopes sms_classes to only classes this
    // student is enrolled in, but the filter dropdown should offer every
    // class resources exist for.
    admin.from('sms_classes').select('id, name').order('name'),
    // RLS ("assignments: student read published in own class") already
    // scopes this to the student's own enrolled classes -- a resource
    // assigned to a class this student isn't in just won't come back.
    supabase.from('sms_assignments').select('id, resource_id').not('resource_id', 'is', null),
  ])

  const assignmentByResource = new Map((assignments ?? []).map((a) => [a.resource_id as string, a.id]))
  const assignmentIds = (assignments ?? []).map((a) => a.id)

  const { data: mySubmissions } =
    assignmentIds.length > 0
      ? await supabase.from('sms_submissions').select('assignment_id').eq('student_id', student?.id ?? '').in('assignment_id', assignmentIds)
      : { data: [] as { assignment_id: string }[] }

  const completedAssignmentIds = new Set((mySubmissions ?? []).map((s) => s.assignment_id))

  const resourceAssignments: Record<string, { assignmentId: string; completed: boolean }> = {}
  assignmentByResource.forEach((assignmentId, resourceId) => {
    resourceAssignments[resourceId] = { assignmentId, completed: completedAssignmentIds.has(assignmentId) }
  })

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
        resourceAssignments={resourceAssignments}
      />
    </div>
  )
}
