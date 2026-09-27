// The set of engine ids LivePlayClient.tsx actually branches to a
// dedicated play component for -- kept as a pure, framework-free list
// (rather than inline in the client component) specifically so it's
// directly testable: this list is the concrete, verifiable truth
// behind every engine's `liveClassroomSupport` registry flag. An
// engine belongs here ONLY once LivePlayClient.tsx genuinely mounts
// its own play component for it (not the generic GameSessionRuntime
// fallback) -- classic-quiz is deliberately absent from this list even
// though its liveClassroomSupport is true, because classic-quiz IS the
// generic GameSessionRuntime fallback (a thin reference engine with no
// custom visual layer of its own), so it needs no dedicated branch.
export const LIVE_CLASSROOM_INTEGRATED_ENGINE_IDS = ['racing', 'boss-battle', 'tower-defense', 'word-ninja', 'matching', 'memory'] as const

export function hasDedicatedLiveClassroomComponent(engineId: string): boolean {
  return (LIVE_CLASSROOM_INTEGRATED_ENGINE_IDS as readonly string[]).includes(engineId)
}
