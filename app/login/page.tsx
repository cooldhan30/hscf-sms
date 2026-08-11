import { SignIn } from '@clerk/nextjs'

export default function LoginPage() {
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
            Sign in to your account
          </p>
        </div>
        {/*
          Hash-based routing, not path-based: our post-sign-in redirect
          targets (role dashboards, /pending-approval) live outside /login,
          which path-based routing doesn't support -- Clerk's own
          useEnforceCatchAllRoute check throws once the URL changes but the
          component is still transitioning. Hash routing has no such
          constraint and needs no catch-all segment.
        */}
        <div className="flex justify-center">
          <SignIn routing="hash" signUpUrl="/tamizhi/sign-up" />
        </div>
      </div>
    </div>
  )
}
