// Leading + trailing call coalescer -- pure and DOM-free (timers are
// injectable) so scripts/verify-gameroom-v2-performance.ts can drive it
// with a fake clock.
//
// Why it exists: Live Classroom clients subscribe to Realtime changes on
// sms_gamev2_live_participants, and EVERY participant's 8-second
// heartbeat is an UPDATE on that table. Refetching on every event means
// each client refetches about N/8 times a second (N = connected
// students), i.e. roughly N^2/8 requests a second class-wide -- ~110
// req/s for a class of 30, almost all of them returning an identical
// roster. Coalescing caps that at one refetch per window per client while
// still guaranteeing the LAST event in a burst is always reflected (the
// trailing call), so no state change is ever missed.
export interface CoalescerTimers {
  setTimeout: (fn: () => void, ms: number) => unknown
  clearTimeout: (handle: unknown) => void
  now: () => number
}

const defaultTimers: CoalescerTimers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  now: () => Date.now(),
}

export function createCoalescer(fn: () => void, windowMs: number, timers: CoalescerTimers = defaultTimers) {
  let lastRunAt = -Infinity
  let pending: unknown = null

  function run() {
    pending = null
    lastRunAt = timers.now()
    fn()
  }

  return {
    // Runs immediately if the window has elapsed since the last run;
    // otherwise schedules exactly one trailing run at the end of the
    // window (further calls in the same window are absorbed into it).
    call() {
      const elapsed = timers.now() - lastRunAt
      if (elapsed >= windowMs && pending === null) {
        run()
        return
      }
      if (pending === null) {
        pending = timers.setTimeout(run, Math.max(0, windowMs - elapsed))
      }
    },
    // Must be called on unmount so a trailing run never fires into a
    // torn-down component.
    cancel() {
      if (pending !== null) timers.clearTimeout(pending)
      pending = null
    },
  }
}
