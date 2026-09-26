// Standalone verification script for the shared V2 card/grid layer
// (lib/gameRoomV2/cardGrid/*) used by both Matching and Memory. Same
// tsx-script convention as every other verify-gameroom-v2-*.ts script.
// Covers: card construction from a stripped MATCH payload (no client-
// side pair guessing -- the core "do not duplicate question storage"
// guarantee), deterministic shuffling, and grid sizing.
//
// Run with: npx tsx scripts/verify-gameroom-v2-card-grid.ts

import { buildCardsFromMatchPayload, shuffledWithSeed, gridColumnsForCardCount } from '../lib/gameRoomV2/cardGrid/cards'

let failures = 0

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  FAIL: ${message}`)
    failures++
  } else {
    console.log(`  ok: ${message}`)
  }
}

console.log('== Card construction from a MATCH payload ==')
const left = ['puli', 'yaanai', 'naai']
const right = ['tiger', 'elephant', 'dog']
const cards = buildCardsFromMatchPayload(left, right)
assert(cards.length === 6, `one card per pair-side (3 pairs -> 6 cards, found ${cards.length})`)
assert(cards.filter((c) => c.side === 'left').length === 3, 'exactly 3 left-side cards')
assert(cards.filter((c) => c.side === 'right').length === 3, 'exactly 3 right-side cards')

assert(cards.every((c) => !('pairId' in c)), 'cards carry no pair identity -- /state shuffles the two sides independently, so the client must not guess pairs from positions')
assert(new Set(cards.map((c) => c.id)).size === cards.length, 'every card has a unique id')

console.log('\n== Card construction never invents content ==')
assert(cards.every((c) => left.includes(c.label) || right.includes(c.label)), 'every card label comes directly from the given left/right arrays -- nothing is fabricated')
const mismatchedLength = buildCardsFromMatchPayload(['a', 'b', 'c'], ['x', 'y'])
assert(mismatchedLength.length === 5, 'mismatched left/right array lengths never throw (one card per item)')

console.log('\n== Deterministic shuffling ==')
const itemsToShuffle = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const shuffle1 = shuffledWithSeed(itemsToShuffle, 'session-xyz')
const shuffle2 = shuffledWithSeed(itemsToShuffle, 'session-xyz')
assert(JSON.stringify(shuffle1) === JSON.stringify(shuffle2), 'the SAME seed always produces the SAME shuffle order (no visible re-shuffle on re-render)')
assert(shuffle1.length === itemsToShuffle.length, 'shuffling never drops or duplicates items')
assert([...shuffle1].sort().join(',') === [...itemsToShuffle].sort().join(','), 'shuffling is a pure reordering -- the same multiset of items, just reordered')
const shuffle3 = shuffledWithSeed(itemsToShuffle, 'session-different')
assert(JSON.stringify(shuffle1) !== JSON.stringify(shuffle3), 'a different seed produces a genuinely different shuffle order')

console.log('\n== Grid sizing scales with card count ==')
assert(gridColumnsForCardCount(6).base === 2, 'a small round (<=6 cards) uses a 2-column base grid')
assert(gridColumnsForCardCount(12).base === 3, 'a medium round (<=12 cards) uses a 3-column base grid')
assert(gridColumnsForCardCount(20).base === 4, 'a large round (>12 cards) uses a 4-column base grid')
assert(gridColumnsForCardCount(6).sm >= gridColumnsForCardCount(6).base, 'the sm breakpoint never has FEWER columns than the base layout')

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${failures} failure(s).`)
process.exit(failures === 0 ? 0 : 1)
