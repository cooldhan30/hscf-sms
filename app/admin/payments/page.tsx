import { PaymentsClient } from './PaymentsClient'

export const dynamic = 'force-dynamic'

export default function AdminPaymentsPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">Payments</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">
          Registration fee status for each student, with their parents&apos; contact details.
        </p>
      </div>

      <PaymentsClient />
    </div>
  )
}
