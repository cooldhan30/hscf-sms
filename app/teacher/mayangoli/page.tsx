import Link from 'next/link'
import { MayangoliHostClient } from './MayangoliHostClient'

export const dynamic = 'force-dynamic'

export default function MayangoliTeacherPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary-900 dark:text-white">மயங்கொலி Challenge</h1>
          <p className="text-stone-500 dark:text-stone-400 mt-1">
            A live, synchronized classroom quiz on Mayangoli letters (ல்/ள்/ழ், ன்/ண்/ந், ர்/ற்) -- everyone answers the
            same question at once, then you reveal the results together.
          </p>
        </div>
        <Link
          href="/teacher/mayangoli/words"
          className="shrink-0 text-sm font-semibold text-primary-700 dark:text-primary-400 hover:underline whitespace-nowrap mt-1"
        >
          Word Bank
        </Link>
      </div>

      <MayangoliHostClient />
    </div>
  )
}
