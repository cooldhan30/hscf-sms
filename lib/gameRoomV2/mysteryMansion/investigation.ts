import { MANSION_ROOMS, ROOM_COUNT, type RoomId } from './rooms'
import { generateMystery, type GeneratedMystery } from './generator'
import type { MysteryMansionDifficultySettings } from './difficulty'

// "Leads" are Mystery Mansion's forgiveness resource (parallel to
// Treasure Quest's keys / Space Mission's shields) -- a wrong answer
// under Detective/Master Detective costs one, but a lead is never
// required to keep moving; it only ever affects a small cosmetic
// "confidence" readout. This satisfies "incorrect answers should
// allow recovery without destroying previously earned progress":
// clues already collected and rooms already unlocked are NEVER
// removed by a wrong answer, no matter how many leads are lost.
const STARTING_LEADS = 3

export interface InvestigationState {
  difficulty: MysteryMansionDifficultySettings['id']
  mystery: GeneratedMystery
  currentRoomIndex: number
  unlockedRoomIds: RoomId[]
  // Which rooms' clues have been solved, in room order -- tracked by
  // ROOM ID (never by clue text) specifically because two rooms can
  // coincidentally generate identical clue phrasing (the same
  // CLUE_PHRASINGS entry picked twice for the same mystery item);
  // deduplicating by string content would silently drop a genuinely
  // distinct room's clue. cluesFound() below derives the display list
  // from this.
  solvedRoomIds: RoomId[]
  leads: number
  currentStreak: number
  bestStreak: number
  correctAnswerCount: number
  wrongAnswerCount: number
  mysterySolved: boolean
}

export function createInitialInvestigation(seed: string, settings: MysteryMansionDifficultySettings): InvestigationState {
  return {
    difficulty: settings.id,
    mystery: generateMystery(seed),
    currentRoomIndex: 0,
    unlockedRoomIds: [MANSION_ROOMS[0].id],
    solvedRoomIds: [],
    leads: STARTING_LEADS,
    currentStreak: 0,
    bestStreak: 0,
    correctAnswerCount: 0,
    wrongAnswerCount: 0,
    mysterySolved: false,
  }
}

export function currentRoom(state: InvestigationState) {
  return MANSION_ROOMS[state.currentRoomIndex]
}

// The clue text collected so far, in room order -- derived from
// solvedRoomIds (never stored redundantly), so two rooms sharing the
// same phrasing still both appear as separate entries.
export function cluesFound(state: InvestigationState): string[] {
  return MANSION_ROOMS.filter((r) => state.solvedRoomIds.includes(r.id)).map((r) => state.mystery.clueByRoomId[r.id])
}

// A correct answer reveals the current room's clue and unlocks the
// door to the next room -- the entire "answering Tamil questions
// reveals clues; correct answers unlock doors" loop in one step, no
// separate door-opening action needed. Solving the FINAL room's own
// question (not merely reaching it) is what solves the mystery --
// currentRoomIndex intentionally stays pinned at the last room once
// there, rather than advancing past the end of MANSION_ROOMS.
export function applyCorrectAnswer(state: InvestigationState): InvestigationState {
  const room = currentRoom(state)
  const isFinalRoom = state.currentRoomIndex === ROOM_COUNT - 1
  const nextIndex = Math.min(ROOM_COUNT - 1, state.currentRoomIndex + 1)
  const nextRoom = MANSION_ROOMS[nextIndex]
  const nextStreak = state.currentStreak + 1

  return {
    ...state,
    solvedRoomIds: state.solvedRoomIds.includes(room.id) ? state.solvedRoomIds : [...state.solvedRoomIds, room.id],
    currentRoomIndex: nextIndex,
    unlockedRoomIds: state.unlockedRoomIds.includes(nextRoom.id) ? state.unlockedRoomIds : [...state.unlockedRoomIds, nextRoom.id],
    currentStreak: nextStreak,
    bestStreak: Math.max(state.bestStreak, nextStreak),
    correctAnswerCount: state.correctAnswerCount + 1,
    mysterySolved: isFinalRoom || state.mysterySolved,
  }
}

// A wrong answer costs a lead (never below zero) and resets the
// streak, but the student stays in the SAME room to try the next
// question -- never sent backward, never loses an already-collected
// clue or an already-unlocked room. Running out of leads is purely
// cosmetic (a "running low on leads" note), never a blocker: there is
// no failure state in Mystery Mansion, matching every other V2
// engine's "recoverable, not punitive" consequence design.
export function applyWrongAnswer(state: InvestigationState, settings: MysteryMansionDifficultySettings): InvestigationState {
  return {
    ...state,
    leads: settings.wrongAnswerCostsLead ? Math.max(0, state.leads - 1) : state.leads,
    currentStreak: 0,
    wrongAnswerCount: state.wrongAnswerCount + 1,
  }
}

export function investigationProgressPct(state: InvestigationState): number {
  return Math.round((state.solvedRoomIds.length / ROOM_COUNT) * 100)
}
