'use client'

import { toast as sonnerToast } from 'sonner'

// Thin re-export so call sites (`toast.success(...)`, `toast.error(...)`)
// don't import sonner directly -- keeps the toast library swappable and
// gives every success/error path in the app the same entry point instead
// of the previous mix of alert() and one-off inline error banners.
export const toast = sonnerToast
