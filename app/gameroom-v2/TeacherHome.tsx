import Link from 'next/link'
import { FiBookOpen, FiFolder, FiShare2, FiPlus, FiBarChart2, FiUsers, FiArrowRight, FiEdit3 } from 'react-icons/fi'
import { PageHeader, SectionCard, primaryLinkButton, secondaryLinkButton } from '@/components/gameRoomV2/shell/ui'
import { LEARNING_BOARDS, allTopicSummaries } from '@/lib/gameRoomV2/builtin/summaries'

// Teacher (and admin) GameRoom home: built-in Tamil content first, then
// the teacher's own and shared question sets, with the tools to build,
// host and review.
export function TeacherHome({ mySetCount, sharedSetCount }: { mySetCount: number; sharedSetCount: number }) {
  const topics = allTopicSummaries()
  const liveTopicCount = topics.filter((t) => t.engines.some((e) => e.live)).length

  const tiles = [
    {
      href: '/gameroom-v2/topics',
      icon: FiBookOpen,
      title: 'Built-in Tamil Content',
      text: `${topics.length} ready-made topics across ${LEARNING_BOARDS.length} Learning Boards. Read-only -- duplicate to customise.`,
    },
    { href: '/gameroom-v2/library?tab=my-sets', icon: FiFolder, title: 'My Question Sets', text: `${mySetCount} set${mySetCount === 1 ? '' : 's'} you created.` },
    {
      href: '/gameroom-v2/library?tab=shared',
      icon: FiShare2,
      title: 'Shared Question Sets',
      text: `${sharedSetCount} set${sharedSetCount === 1 ? '' : 's'} shared by other teachers.`,
    },
    { href: '/gameroom-v2/builder', icon: FiEdit3, title: 'Question Set Builder', text: 'Create and edit your own question sets.' },
    { href: '/gameroom-v2/analytics', icon: FiBarChart2, title: 'Analytics', text: 'See how your students are doing on your sets.' },
    {
      href: '/gameroom-v2/topics?game=classic-quiz',
      icon: FiUsers,
      title: 'Live Classroom',
      text: `Host any of ${liveTopicCount} built-in topics (or your own sets) live with a join code.`,
    },
  ]

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Game Room"
        tamilTitle="விளையாட்டு அறை"
        description="Tamil learning games for your classes -- use the built-in content or build your own."
        actions={
          <>
            <Link href="/gameroom-v2/library" className={secondaryLinkButton}>
              <FiFolder className="w-4 h-4" aria-hidden /> Question Set Library
            </Link>
            <Link href="/gameroom-v2/builder/new" className={primaryLinkButton}>
              <FiPlus className="w-4 h-4" aria-hidden /> Create Question Set
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tiles.map((t) => (
          <Link
            key={t.title}
            href={t.href}
            className="group p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 hover:border-primary-300 dark:hover:border-primary-800 transition-colors"
          >
            <t.icon className="w-5 h-5 mb-3 text-primary-700 dark:text-primary-400" aria-hidden />
            <p className="font-semibold text-stone-800 dark:text-stone-100 group-hover:text-primary-800 dark:group-hover:text-primary-300">{t.title}</p>
            <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">{t.text}</p>
          </Link>
        ))}
      </div>

      <SectionCard title="Learning Boards" action={{ href: '/gameroom-v2/boards', label: 'View all' }}>
        <ul className="divide-y divide-stone-100 dark:divide-stone-800">
          {LEARNING_BOARDS.map((b) => (
            <li key={b.id}>
              <Link href={`/gameroom-v2/boards/${b.id}`} className="flex items-center justify-between gap-3 py-3 group">
                <span className="min-w-0">
                  <span className="block font-medium text-stone-800 dark:text-stone-100 group-hover:text-primary-700 dark:group-hover:text-primary-400">
                    {b.title} <span className="font-tamil leading-relaxed text-stone-500 dark:text-stone-400 font-normal">· {b.tamilTitle}</span>
                  </span>
                  <span className="block text-sm text-stone-500 dark:text-stone-400">
                    {b.topicKeys.length} topics -- {b.description}
                  </span>
                </span>
                <FiArrowRight className="w-4 h-4 text-stone-400 flex-shrink-0" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  )
}
