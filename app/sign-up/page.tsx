import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-stone-950 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-primary-900 dark:text-white">
            TSCF School Management
          </h1>
          <p className="text-sm font-tamil text-terracotta-600 dark:text-terracotta-400 mt-1">
            பள்ளி நிர்வாகம்
          </p>
          <p className="text-stone-500 dark:text-stone-400 mt-3 text-sm">
            Create your account
          </p>
        </div>
        {/* Hash routing, not path -- see app/login/page.tsx for why. Role,
            name, etc. are collected afterward on /pending-approval, not
            here -- this keeps sign-up working the same way regardless of
            whether someone uses email/password or Google/Apple OAuth. */}
        <div className="flex justify-center">
          <SignUp routing="hash" signInUrl="/tamizhi/login" />
        </div>
      </div>
    </div>
  )
}
