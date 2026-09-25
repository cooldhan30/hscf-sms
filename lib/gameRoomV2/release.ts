import 'server-only'

// GameRoom V2 public-release switch (there is no feature-flag framework
// in this codebase; this is a single env var, read server-side).
//
//   GAMEROOM_V2_ENABLED unset / anything but 'false'  -> released: every
//     active student/teacher may use V2 (normal auth, role, ownership,
//     enrollment and RLS checks all still apply).
//   GAMEROOM_V2_ENABLED=false                         -> ROLLBACK: V2 goes
//     back to the sms_gamev2_testers allowlist (admins always pass), and
//     /gameroom sends everyone straight to Classic GameRoom.
//
// Rollback = set the env var in Vercel and redeploy. Nothing is deleted.
export function isGameRoomV2Released(): boolean {
  return process.env.GAMEROOM_V2_ENABLED !== 'false'
}
