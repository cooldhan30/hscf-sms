# GameRoom V2 — emergency rollback

GameRoom V2 is the only GameRoom users see. The sidebar's **Game Room** item
goes to `/gameroom`, which opens V2 directly. The legacy ("Classic") GameRoom
is still deployed, unchanged, as a backup. It is not linked from anywhere.

Use this procedure only if V2 has a severe production problem. It is an
env-var switch. It deletes nothing and needs no database changes.

## Roll back to the legacy GameRoom

1. In Vercel, open project **hscf-sms** (scope `cooldhan30-gmailcoms-projects`)
   and go to **Settings → Environment Variables**.
2. Add (or edit) `GAMEROOM_V2_ENABLED` = `false` for **Production**.
3. Redeploy production so the new value takes effect. Either:
   - Vercel dashboard → **Deployments** → the current production deployment →
     **Redeploy**, or
   - from the repo: `npx vercel --prod --scope cooldhan30-gmailcoms-projects`
4. Check the result as a student and as a teacher:
   `https://tamilschoolfl.org/tamizhi/gameroom` should open
   `/student/game-room` or `/teacher/game-room`, the legacy GameRoom.

What changes while rolled back (see `lib/gameRoomV2/release.ts`):

| | `GAMEROOM_V2_ENABLED` unset (normal) | `GAMEROOM_V2_ENABLED=false` (rollback) |
|---|---|---|
| `/gameroom` (sidebar) | GameRoom V2 home | Legacy GameRoom for the user's role |
| `/gameroom-v2/*` pages and APIs | All active students and teachers | Admins, plus accounts in `sms_gamev2_testers` only |
| Legacy pages `/student/game-room`, `/teacher/game-room` | Reachable by direct URL only | Reached through `/gameroom` |

All V2 data (question sets, built-in content, sessions, XP, achievements) is
kept as-is. Security rules (RLS, ownership, answer-key protection, and
server-side scoring, XP and achievements) apply in both modes.

## Restore V2

1. Delete `GAMEROOM_V2_ENABLED` in Vercel, or set it to anything other than
   `false`.
2. Redeploy production the same way as in step 3 above.
3. Check that `https://tamilschoolfl.org/tamizhi/gameroom` opens the V2 home.

## Notes

- There is no automatic rollback and no scheduled removal of the legacy
  GameRoom. Both happen only when someone decides to.
- Built-in Tamil content syncs into the database the first time a GameRoom
  page loads after a deploy. To run the sync by hand:
  `npx tsx scripts/sync-gameroom-v2-builtin.ts` (add `--check` to only
  report whether it's up to date).
- Do not delete the V2 implementation to roll back. Use the switch above.
