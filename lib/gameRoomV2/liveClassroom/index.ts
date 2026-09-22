// Deliberately does NOT re-export requireLiveSession.ts (it has its own
// 'server-only' guard) -- mirrors how requireSession.ts/requireAccess.ts
// /requireTeacherAccess.ts are never barreled elsewhere in
// lib/gameRoomV2/ either, so a client component can safely import
// from this index without accidentally pulling in server-only code.
export { deriveLiveNickname } from './nickname'
export { isPresenceStale, isPresentlyConnected } from './presence'
export { normalizeJoinCode } from './joinCode'
export { LIVE_CLASSROOM_INTEGRATED_ENGINE_IDS, hasDedicatedLiveClassroomComponent } from './engineBranch'
