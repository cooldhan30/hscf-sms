# GameRoom V2 (foundation phase)

This is a from-scratch, isolated rebuild of Game Room. **Nothing here is
wired into, imported by, or capable of affecting the production Game
Room** at `lib/gameRoom/*`, `app/api/game-room/*`,
`app/teacher/game-room/*`, or `app/student/game-room/*`. See
`scripts/verify-gameroom-v2-isolation.ts` for the automated proof of that.

## Architectural principle: content vs. gameplay

Legacy Game Room bundles a game's questions and its play engine together
— each `GameModule` (`lib/gameRoom/gameModule.ts`) owns its own
`getQuestionBank()`. That means a new question set can only ever be
played through the one engine it was written for.

V2 splits this in two:

- **Content** — a `GameRoomQuestionSet` (`domain/content.ts`), a
  reusable bank of `GameRoomQuestion`s a teacher authors once. It has no
  reference to any game engine at all.
- **Gameplay** — a `GameEngine` (`domain/engine.ts`), a way of *playing*
  a compatible question set. An engine declares
  `compatibility.supportedQuestionTypes`; a question set is playable by
  an engine only if every question in the set has a type the engine
  supports. Nothing hardcodes which engines go with which sets — it's
  computed every time via `registry.ts`'s `compatibleEnginesForQuestionTypes()`.

This is why the same question set ("திணை, பால், எண், காலம், இடம்") can
eventually be played as Classic Quiz, Tower Defense, Boss Battle, Racing,
or Treasure Quest — swapping engines never means re-authoring content.

## What exists today (foundation phase only)

- `domain/questionTypes.ts` — the `GameRoomQuestionType` enum (10
  implemented-eventually + 2 explicitly roadmap-only:
  `PRONUNCIATION`, `READING_FLUENCY`) and each type's payload shape.
- `domain/content.ts` — `GameRoomQuestionSet`, `GameRoomQuestion`.
- `domain/engine.ts` — `GameEngine`, `GameEngineCompatibility`,
  `GameEngineStatus`.
- `domain/session.ts` — `GameSession`, `GamePlayer`, `GameResponse`,
  `GameResult`, `GameReward`. **No database tables back these yet** —
  they're the settled domain shape a future engine implementation will
  persist against, once a specific engine is actually built end-to-end.
- `registry.ts` — `GAME_ENGINES_V2`, 5 engines registered as metadata
  (`status: 'COMING_SOON'` for all of them — none are playable yet).
- `requireAccess.ts` — `requireGameV2Access()`, the access gate.

## Database

Migration `073_gameroom_v2_foundation.sql` adds, additively, with zero
changes to any existing table:

- `sms_gamev2_testers` — the access allowlist (see below).
- `sms_gamev2_question_sets`, `sms_gamev2_questions` — the content model.

No session/player/answer tables exist yet — those come with the first
real playable engine (see "Next phase" below), per the original scoped
plan.

## Access gate

There is no feature-flag system anywhere in this codebase. Rather than
build one for a single soft-launch feature, V2 follows the same
data-gated-access precedent Tamil Theni already uses in production
(`sms_theni_enrollments`): a signed-in user only gets past
`requireGameV2Access()` if they're an **admin**, or they have a row in
`sms_gamev2_testers`. The route itself
(`/gameroom-v2`, `/api/gameroom-v2/*`) is not linked from any nav —
it's reachable only by a direct link, exactly like Tamil Theni was
before it had a season to join.

To add a tester, insert a row directly (via the Supabase dashboard or
an admin script):

```sql
INSERT INTO sms_gamev2_testers (profile_id, added_by, notes)
VALUES ('<clerk_user_id>', '<admin_profile_id>', 'pilot teacher');
```

## Verifying nothing broke

```
npx tsx scripts/verify-gameroom-v2-isolation.ts   # legacy untouched + no cross-imports
npx tsx scripts/verify-gameroom-v2-domain.ts       # domain/registry logic
npx tsc --noEmit && npm run lint && npm run build
```

## Explicitly out of scope for this phase

- No game engine is implemented (all `COMING_SOON`).
- No multiplayer.
- No session/player/answer persistence.
- No nav link anywhere.
- No changes to legacy Game Room.

## Next phase (not started)

Build exactly one engine (Classic Quiz) end-to-end against the content
model above: session/player/answer tables scoped to V2 only
(`sms_gamev2_sessions` etc., never `sms_game_*`), a `requireGameV2Player`
guard mirroring `lib/gameRoom/requirePlayer.ts`'s pattern without
importing it, and real teacher/student play UI under the same
`/gameroom-v2` route tree.
