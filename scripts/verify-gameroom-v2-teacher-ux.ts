// Standalone verification script for the GameRoom V2 teacher-experience
// pass: Library sort ordering, AssignModal's reassignment-warning logic,
// and the "every playable engine shows a duration" invariant that
// CompatibilityResults.tsx and ChooseGameModal.tsx both now rely on.
// Same tsx-script convention as every other verify-gameroom-v2-*.ts
// script -- no Jest/Vitest in this repo.
//
// Run with: npx tsx scripts/verify-gameroom-v2-teacher-ux.ts

import { GAME_ENGINES_V2 } from '../lib/gameRoomV2/registry'

let failures = 0

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  FAIL: ${message}`)
    failures++
  } else {
    console.log(`  ok: ${message}`)
  }
}

console.log('== Every playable engine has a real, positive duration ==')
// Mirrors CompatibilityResults.tsx and ChooseGameModal.tsx, both of
// which now display `~${engine.estimatedDurationMinutes} min` next to
// any ACTIVE/BETA engine -- if this were ever 0/undefined/negative for
// a playable engine, teachers would see a nonsensical "~0 min" or
// "~undefined min" badge.
for (const engine of GAME_ENGINES_V2) {
  if (engine.status === 'ACTIVE' || engine.status === 'BETA') {
    assert(
      typeof engine.estimatedDurationMinutes === 'number' && engine.estimatedDurationMinutes > 0,
      `${engine.id} (${engine.status}) has a positive estimatedDurationMinutes`
    )
  }
}

console.log('\n== Library sort: mirrors LibraryClient.tsx comparator logic ==')
interface TestSet {
  id: string
  title: string
  tamil_title: string | null
  usageCount: number
  estimated_duration_minutes: number | null
}

function sortByTitle(sets: TestSet[]): TestSet[] {
  return [...sets].sort((a, b) => (a.tamil_title || a.title).localeCompare(b.tamil_title || b.title))
}
function sortByUsage(sets: TestSet[]): TestSet[] {
  return [...sets].sort((a, b) => b.usageCount - a.usageCount)
}
function sortByDuration(sets: TestSet[]): TestSet[] {
  return [...sets].sort((a, b) => (a.estimated_duration_minutes ?? Infinity) - (b.estimated_duration_minutes ?? Infinity))
}

const sample: TestSet[] = [
  { id: 'a', title: 'Zebra Set', tamil_title: null, usageCount: 2, estimated_duration_minutes: 15 },
  { id: 'b', title: 'Apple Set', tamil_title: null, usageCount: 9, estimated_duration_minutes: null },
  { id: 'c', title: 'Mango Set', tamil_title: null, usageCount: 5, estimated_duration_minutes: 5 },
]

assert(
  sortByTitle(sample).map((s) => s.id).join(',') === 'b,c,a',
  'title sort orders Apple, Mango, Zebra alphabetically'
)
assert(
  sortByUsage(sample).map((s) => s.id).join(',') === 'b,c,a',
  'usage sort puts the most-used set (9x) first'
)
assert(
  sortByDuration(sample).map((s) => s.id).join(',') === 'c,a,b',
  'duration sort puts the shortest set first and pushes sets with no duration set to the end'
)

console.log('\n== AssignModal: reassignment warning only fires on an actual class change ==')
// Mirrors AssignModal.tsx's `willReassign` computation.
function willReassign(currentClassId: string | null | undefined, selectedClassId: string): boolean {
  return Boolean(currentClassId) && selectedClassId !== currentClassId
}

assert(willReassign(null, 'class-1') === false, 'a set with no prior assignment never shows the reassignment warning')
assert(willReassign('class-1', 'class-1') === false, 'reselecting the SAME class does not warn')
assert(willReassign('class-1', 'class-2') === true, 'picking a DIFFERENT class than the current one warns')

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${failures} failure(s).`)
process.exit(failures === 0 ? 0 : 1)
