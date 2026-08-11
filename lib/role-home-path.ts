import type { SmsRole } from '@/types/database'

// Pure, no server dependencies -- safe to import from both client and
// server code. lib/auth.ts re-exports this for server-side call sites
// that already import from there.
export function roleHomePath(role: SmsRole): string {
  switch (role) {
    case 'admin':
      return '/admin'
    case 'teacher':
      return '/teacher'
    case 'student':
      return '/student'
    case 'parent':
      return '/parent'
    case 'pending':
      return '/pending-approval'
  }
}
