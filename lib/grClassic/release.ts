import 'server-only'

// GameRoom Classic release switch. Off in production until the user
// approves a release: GR_CLASSIC_ENABLED=true turns it on, and local
// `next dev` always has it on. Turning it off hides every /gr-classic
// page (404); nothing is deleted. GameRoom Classic is isolated from the
// legacy GameRoom and GameRoom V2 -- see scripts/verify-grc-isolation.ts.
export function isGrClassicEnabled(): boolean {
  return process.env.GR_CLASSIC_ENABLED === 'true' || process.env.NODE_ENV === 'development'
}
