import { getRoom, START_ROOM_ID, TREASURE_ROOM_ID, type RoomId } from './rooms'
import { HARD_KEY_EVERY_OTHER_CORRECT_ANSWER, type TreasureQuestDifficultySettings } from './difficulty'

export interface ExplorationState {
  difficulty: TreasureQuestDifficultySettings['id']
  currentRoomId: RoomId
  visitedRoomIds: RoomId[]
  cluesFound: string[]
  keys: number
  correctAnswerCount: number
  treasureFound: boolean
}

export function createInitialExploration(settings: TreasureQuestDifficultySettings): ExplorationState {
  const startRoom = getRoom(START_ROOM_ID)
  return {
    difficulty: settings.id,
    currentRoomId: START_ROOM_ID,
    visitedRoomIds: [START_ROOM_ID],
    cluesFound: startRoom.clue ? [startRoom.clue] : [],
    keys: 0,
    correctAnswerCount: 0,
    treasureFound: false,
  }
}

// How many keys a single correct answer earns -- a pure function of the
// difficulty setting and how many correct answers have already
// happened, so Hard's "half the time" rule stays fully deterministic
// and testable rather than relying on Math.random().
export function keysEarnedForAnswer(settings: TreasureQuestDifficultySettings, correctAnswerCountBefore: number): number {
  if (settings.id === 'hard' && HARD_KEY_EVERY_OTHER_CORRECT_ANSWER) {
    return correctAnswerCountBefore % 2 === 0 ? settings.keysPerCorrectAnswer : 0
  }
  return settings.keysPerCorrectAnswer
}

export function applyCorrectAnswer(state: ExplorationState, settings: TreasureQuestDifficultySettings): ExplorationState {
  const earned = keysEarnedForAnswer(settings, state.correctAnswerCount)
  return {
    ...state,
    keys: state.keys + earned,
    correctAnswerCount: state.correctAnswerCount + 1,
  }
}

// A wrong answer's consequence: costs one key if the player has one to
// lose (never goes negative, never blocks progress outright) -- a real
// but recoverable setback, matching the "meaningful but age-appropriate
// consequence" bar every V2 engine holds itself to.
export function applyWrongAnswer(state: ExplorationState, settings: TreasureQuestDifficultySettings): ExplorationState {
  if (!settings.wrongAnswerCostsKey) return state
  return { ...state, keys: Math.max(0, state.keys - 1) }
}

export function canEnterRoom(state: ExplorationState, toRoomId: RoomId): boolean {
  const door = getRoom(state.currentRoomId).doors.find((d) => d.toRoomId === toRoomId)
  if (!door) return false
  return state.keys >= door.keysRequired
}

// Moves into an adjacent, affordable room -- spends the door's key
// cost, marks the room visited, and collects its clue on first entry.
// Returns the state unchanged if the move isn't legal (no such door, or
// not enough keys), so a caller never needs to pre-validate before
// calling this.
export function enterRoom(state: ExplorationState, toRoomId: RoomId): ExplorationState {
  const door = getRoom(state.currentRoomId).doors.find((d) => d.toRoomId === toRoomId)
  if (!door || state.keys < door.keysRequired) return state

  const room = getRoom(toRoomId)
  const alreadyVisited = state.visitedRoomIds.includes(toRoomId)
  const newClue = !alreadyVisited && room.clue ? [room.clue] : []

  return {
    ...state,
    currentRoomId: toRoomId,
    keys: state.keys - door.keysRequired,
    visitedRoomIds: alreadyVisited ? state.visitedRoomIds : [...state.visitedRoomIds, toRoomId],
    cluesFound: [...state.cluesFound, ...newClue],
    treasureFound: toRoomId === TREASURE_ROOM_ID,
  }
}
