import Link from 'next/link'
import { FiUser, FiUsers, FiHardDrive, FiChevronRight, FiBarChart2 } from 'react-icons/fi'

export const dynamic = 'force-dynamic'

const REPORTS = [
  {
    href: '/admin/reports/teachers',
    title: 'Teacher Details',
    description: 'Name, classes taught, contact info, and other sign-up details for every teacher.',
    icon: FiUser,
  },
  {
    href: '/admin/reports/students',
    title: 'Student Details',
    description: 'Name, Nilai, contact info, parent/guardian details, and payment status for every student.',
    icon: FiUsers,
  },
  {
    href: '/admin/reports/scores',
    title: 'Attendance & Score Reports',
    description: 'Full-year attendance and assignment/exam scores for any class or student, with detail and export.',
    icon: FiBarChart2,
  },
  {
    href: '/admin/reports/storage',
    title: 'Storage Usage Details',
    description: 'Total storage used, split between resources and assignments, by class and by uploader.',
    icon: FiHardDrive,
  },
]

export default function AdminReportsPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">Reports</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">Generate and export reports across the school.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORTS.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="group p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 hover:border-primary-400 dark:hover:border-primary-600 transition-colors"
          >
            <div className="flex items-start justify-between">
              <r.icon className="w-6 h-6 text-primary-700 dark:text-primary-400" />
              <FiChevronRight className="w-4 h-4 text-stone-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors" />
            </div>
            <h2 className="mt-3 font-bold text-stone-800 dark:text-stone-100">{r.title}</h2>
            <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">{r.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
