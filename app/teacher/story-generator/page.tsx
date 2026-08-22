import { createClient } from '@/lib/supabase/server'
import { auth } from '@clerk/nextjs/server'
import { StoryGeneratorClient } from './StoryGeneratorClient'

export const dynamic = 'force-dynamic'

export default async function StoryGeneratorPage() {
  const supabase = createClient()
  const { userId } = await auth()

  const { data: teacher } = await supabase.from('sms_teachers').select('id').eq('profile_id', userId ?? '').single()

  const { data: myClassLinks } = teacher
    ? await supabase.from('sms_class_teachers').select('class:sms_classes(id, name)').eq('teacher_id', teacher.id)
    : { data: [] }

  const classes = ((myClassLinks ?? []) as unknown as { class: { id: string; name: string } | null }[])
    .map((l) => l.class)
    .filter((c): c is { id: string; name: string } => c !== null)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">Story Generator</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">
          Generate a Tamil children&apos;s story from a theme -- pick a Nilai level and let it write.
        </p>
      </div>

      <StoryGeneratorClient classes={classes} />
    </div>
  )
}
