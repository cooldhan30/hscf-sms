import { WordBankAdminClient } from './WordBankAdminClient'

export const dynamic = 'force-dynamic'

export default function MayangoliWordBankAdminPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">Mayangoli Word Bank</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">
          Review and manage the 315-word Mayangoli question bank. Generated content must be reviewed by a teacher
          before it&apos;s marked reviewed or approved.
        </p>
      </div>

      <WordBankAdminClient />
    </div>
  )
}
