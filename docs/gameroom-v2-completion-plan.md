# GameRoom V2 Completion Plan

**GameRoom V2 remains isolated behind tester/admin gating. No phase in this plan adds a production navigation link, modifies legacy GameRoom, or removes access gates. Rollout requires explicit separate authorization.**

This plan is based on a full audit of `lib/gameRoomV2/**`, `app/gameroom-v2/**`, `app/api/gameroom-v2/**`, `components/gameRoomV2/**`, migrations 073-079, and `scripts/verify-gameroom-v2-*.ts`, performed 2026-09-22. Baseline: all 13 verify scripts pass, `tsc --noEmit` passes with 0 errors, `npm run lint` passes with 0 warnings/errors, and `verify-gameroom-v2-isolation.ts` confirms 0 cross-imports with legacy GameRoom.

---

## Phase 0: SECURITY DEFINER privilege-escalation gap in Live Classroom RPCs (P0)

Migration `079_gameroom_v2_live_classroom.sql` defines four `SECURITY DEFINER` functions: `sms_gamev2_start_live_session`, `sms_gamev2_pause_live_session`, `sms_gamev2_resume_live_session`, `sms_gamev2_end_live_session` (lines 301, 349, 364, 403). Unlike `sms_gamev2_resolve_live_session_by_join_code` (which internally re-checks class enrollment, lines 269-272), these four perform **no internal caller-authorization check** — they trust that the calling API route already verified the caller is the session's host teacher (e.g. `app/api/gameroom-v2/live/[id]/start/route.ts` calls `requireLiveSessionHost` before invoking the RPC).

Prior migrations in this codebase (`030_class_promotion.sql`, `031_multi_role.sql`, `033_student_payments.sql`) establish the pattern of `REVOKE ALL ... FROM anon, authenticated` on this class of function, forcing all calls through the guarded route. Migration 079 has **no REVOKE statement** for any of its four functions, so Postgres's default `PUBLIC` grant applies — any authenticated Supabase client (a student, or a teacher who is not the host) can call `supabase.rpc('sms_gamev2_start_live_session', {...})` directly, bypassing `requireLiveSessionHost`, and hijack/start/pause/resume/end another teacher's live session or fabricate participant session rows.

- [ ] Add `REVOKE ALL ON FUNCTION sms_gamev2_start_live_session(...) FROM anon, authenticated;` (and the same for pause/resume/end) in a new migration
- [ ] Alternatively/additionally, add an internal ownership check inside each function body (verify `p_live_session_id`'s `host_teacher_id` matches the calling `sms_current_user_id()`'s teacher record), matching the defense-in-depth style already used by `resolve_live_session_by_join_code`
- [ ] Re-run `scripts/verify-gameroom-v2-live-classroom.ts` and add a new verify case asserting a non-host caller's direct RPC call fails

**Acceptance criteria:** A Postgres role check (or a manual `supabase.rpc()` call as a non-host authenticated user) confirms these four functions reject non-host callers. No behavior change for the existing host-only UI flow.

---

## Phase 1: Registry/reality reconciliation

`registry.ts` declares `liveClassroomSupport: true` for Racing (line 127) and Boss Battle (line 96) alongside Classic Quiz (line 32). In reality, `app/gameroom-v2/live/play/[id]/LivePlayClient.tsx` (lines 30-35, 100-101) **always** mounts the generic `GameSessionRuntime` regardless of `engineId` — it never branches to `RacingGame`/`BossBattleGame`/etc. the way solo play's `PlaySessionClient.tsx` does (lines 43-83). The server-side gate in `app/api/gameroom-v2/live/host/route.ts` (line 45) only checks the registry flag, so a teacher **can** successfully host a live Racing or Boss Battle session today — students just get the plain quiz UI instead of the racing/boss visuals. This is a real, reachable UX mismatch, not just aspirational metadata (migration 079's own header comment, lines 11-14, documents this as "a promise made ahead of this infrastructure existing").

- [ ] Decide near-term fix: either (a) temporarily set `liveClassroomSupport: false` for Racing and Boss Battle until Phase 2 ships, or (b) fast-track Phase 2 for these two engines
- [ ] Audit every other `compatibility` flag (`multiplayerSupport`, `homeworkSupport`) against actual code for all 6 ACTIVE engines
- [ ] Document in `registry.ts` comments which flags are "shipped" vs "architecture ready" consistently (Boss Battle/Racing's multiplayerSupport comments already do this well — extend the convention)

**Acceptance criteria:** For every ACTIVE engine, `liveClassroomSupport: true` implies a teacher hosting that engine live actually renders that engine's real UI to students, verified by a new assertion in `verify-gameroom-v2-live-classroom.ts`.

---

## Phase 2: Live Classroom integration for Racing + Boss Battle

- [ ] `LivePlayClient.tsx` branches by `engineId` the same way `PlaySessionClient.tsx` does, mounting `RacingGame`/`BossBattleGame` (with a live-session-aware wrapper) instead of unconditionally mounting `GameSessionRuntime`
- [ ] Racing live-session join/lobby/start flow renders `Track.tsx` inside the live context
- [ ] Boss Battle live-session join/lobby/start flow renders `BossArena.tsx` inside the live context
- [ ] Host dashboard (`HostDashboardClient.tsx`) shows engine-appropriate progress (not just generic roster) for these two engines
- [ ] `registry.ts` `liveClassroomSupport` flags match real behavior for all 6 ACTIVE engines

**Acceptance criteria:** A teacher can host a live session for Racing or Boss Battle exactly as they can today for Classic Quiz; `verify-gameroom-v2-live-classroom.ts` covers both engines; no regression in Classic Quiz live flow (existing verify cases keep passing).

---

## Phase 3: True multiplayer synchronization (Racing, Boss Battle)

Both engines' simulation layers are already shaped for multiple participants (`lib/gameRoomV2/racing/race.ts`'s `RacerState`, `lib/gameRoomV2/bossBattle/battle.ts`'s `AttackerState`/`applyCorrectAnswerDamage`), but there is no live join-code/realtime-opponent sync — today's "multiplayer" is solo-vs-scripted-rival/solo-vs-boss only.

- [ ] Racing: real-time opponent position sync (via `subscribeToLiveSession`-style realtime channel or a dedicated race-state channel) so multiple students racing together see each other move live
- [ ] Boss Battle: shared boss health pool synced across multiple attackers in real time, using the existing `applyCorrectAnswerDamage` hook (already documented as built for this in `battle.ts:180`'s targeting-rule placeholder comment)
- [ ] `registry.ts` `multiplayerSupport` flags reconciled with what's actually live-synced vs. solo-with-groundwork

**Acceptance criteria:** Two or more students in the same live session see each other's real-time race position / contribute to the same boss health bar; `verify-gameroom-v2-racing.ts`/`verify-gameroom-v2-boss-battle.ts` gain multiplayer-sync test cases.

---

## Phase 3.5: Shared gameplay framework hardening

An architecture audit found that `GameSessionRuntime.tsx` and all 5 custom-visual engines (Tower Defense, Racing, Boss Battle, Treasure Quest, Word Ninja) each reimplemented an identical block of invisible session-lifecycle bookkeeping around their own visual frame, instead of sharing it: the `/state` poll loop (`POLL_INTERVAL_MS = 2000` + `setInterval`), the "finalize once on COMPLETED" effect (play the completion sound, `POST /complete`, build the `GameResult` object literal), the pause/resume toggle (`POST /pause` or `/resume` then re-poll), and the exit handler (`POST /abandon` unless already terminal, then call `onExit`). This was 6 near-byte-for-byte copies of the same ~50 lines (`GameSessionRuntime.tsx:63-135` prior to this change; `TowerDefenseGame.tsx:69-216`, `RacingGame.tsx:51-164`, `BossBattleGame.tsx:55-190`, `TreasureQuestGame.tsx:52-149`, `WordNinjaGame.tsx:61-183`, all prior to this change) — exactly the kind of duplication `GameSessionRuntime.tsx`'s own header comment warned an engine wanting a custom visual frame would have to reimplement.

- [x] Extracted the pure, DOM-free parts of that bookkeeping into `lib/gameRoomV2/gameplay/sessionPolling.ts`: `buildGameResult()` (shapes a `/complete` response into the `GameResult` object every engine built identically, `responses` always `[]`), `shouldAbandonOnExit(status)` (the terminal-status check gating the `/abandon` call), and `pauseToggleEndpoint(status)` (PAUSED → resume, else → pause). Split out specifically so this logic is testable without a DOM.
- [x] Extracted the React-coupled orchestration around those pure helpers into `components/gameRoomV2/gameplay/useGameSessionState.ts` — a generic `useGameSessionState<TState>({ sessionId, enabled, soundEnabled, onCompleted? })` hook owning the poll loop, the one-time completion effect (sound + `/complete` fetch + result), and `togglePause()`/`exit(onExit)` actions. Generic over `TState` so each engine's own `/state` payload shape (Word Ninja's is a strict subset of the others') still flows through with full typing. `enabled` lets an engine defer polling until its own setup picker (difficulty/theme/boss choice) resolves, preserving each engine's original `if (!difficulty) return` guard behavior exactly.
- [x] `GameSessionRuntime.tsx` now calls this hook instead of owning the poll/complete/pause/exit logic itself, and still composes `GameHUD`/`QuestionOverlay`/`GameResultsScreen` exactly as before — no behavior change, no visual change.
- [x] Refactored all 5 custom-visual engines (`TowerDefenseGame.tsx`, `RacingGame.tsx`, `BossBattleGame.tsx`, `TreasureQuestGame.tsx`, `WordNinjaGame.tsx`) to call the same hook, deleting each one's duplicated poll effect, completion effect, and pause/exit handlers. Every engine's own visual simulation (battlefield ticks, race physics, boss phases/abilities, room exploration, word-flight rounds) is untouched — this was a pure invisible-bookkeeping extraction, not a rendering change, per the explicit "do not over-generalize visuals" constraint on this work.
- [x] Verified `useSoundPreference.ts` was already the single sound-preference implementation across all 6 engines (no second localStorage-backed implementation existed) and `QuestionOverlay.tsx`/`QuestionInput.tsx` were already the single shared answer-submission/correctness-feedback path for the 4 engines that mount them (Tower Defense, Racing, Boss Battle, Treasure Quest) — Word Ninja's own inline `/answer` POST is a deliberate, documented exception (`WordNinjaGame.tsx`'s header comment): the lane-slash interaction is a genuinely different UI for the same `CATEGORIZE` question type, submitting the identical answer shape to the same route, so it keeps its own submit effect (now with a small local `submitError` state, since it needed a settable error the shared hook's read-only `error` doesn't expose).
- [x] Did **not** extract combo/multiplier scoring arithmetic into a shared hook: audited Boss Battle's damage math, Racing's boost/penalty math, and Tower Defense's coin/wave math (`applyCorrectAnswerDamage`/`applyWrongAnswerConsequence`, `applyAnswerEffect`, `applyCorrectAnswerReward`/`applyWrongAnswerConsequence`) and confirmed each is a genuinely different, engine-specific translation of "correct/incorrect" into that engine's own resource (health, speed, coins) — not the same arithmetic wearing different labels. All already correctly delegate the actual correct/incorrect determination and point value to the server via `QuestionOverlay`'s `onResult`, never recomputing it client-side. Left in each engine's own `lib/gameRoomV2/<engine>/*` module, per this work's explicit constraint not to collapse legitimately different visual/gameplay translations.
- [x] Added `scripts/verify-gameroom-v2-shared-framework.ts`, testing `buildGameResult`/`shouldAbandonOnExit`/`pauseToggleEndpoint` directly (14/14 assertions passing) — the hook itself is exercised indirectly through the 6 engines it now powers, consistent with this repo's tsx-script verification convention (no Jest/Vitest exists or was added).
- [x] Re-ran all 13 pre-existing `scripts/verify-gameroom-v2-*.ts` (all still passing, no assertions needed updating — this was a structural refactor with no behavior change), `scripts/verify-gameroom-v2-isolation.ts` (0 cross-imports, unchanged), `tsc --noEmit` (0 errors), `npm run lint` (0 warnings/errors), and `npm run build` (succeeds).

This accelerated Phase 4: every future engine now has one proven, tested lifecycle hook to mount instead of a 6th (now 7th) copy of the poll/complete/pause/exit block to hand-write and debug — Space Mission (below) is the first engine built entirely on top of this hardened base, with zero duplicated lifecycle code.

**Acceptance criteria:** All 6 pre-existing ACTIVE engines call `useGameSessionState` for session lifecycle instead of reimplementing it; no engine's visual behavior, scoring formula, or reward amount changed; all pre-existing verify scripts plus the new one pass; `tsc`/`lint`/`build`/isolation all clean.

---

## Phase 4: Remaining engines (Space Mission ✅, Kingdom Builder ✅, Mystery Mansion ✅, Matching ✅, Memory ✅, Crossword)

Confirmed at audit time: zero implementation existed for any of these six — no `components/gameRoomV2/*` directory, no route, registry metadata only (`status: 'COMING_SOON'`, `version: '0.0.0'`).

- [x] **Space Mission** — shipped. `lib/gameRoomV2/spaceMission/{route,difficulty,flight}.ts` (a linear checkpoint route through 5 planets; Cadet/Pilot/Commander difficulty tiers altering only thrust/shield-damage parameters, never question difficulty; `FlightState` tracking distance/shields/streak with deterministic streak-driven thrust bonus, capped not unbounded) + `components/gameRoomV2/spaceMission/{SpaceMissionGame,MissionSetupPicker,MissionPath,MissionCompleteScreen,RecoveryBanner}.tsx`. Built around the shared `useGameSessionState`/`QuestionOverlay`/`GameHUD`/`GameResultsScreen` framework from Phase 3.5 (no reimplemented poll/complete/pause/exit logic), so session persistence, scoring, XP/coins, streaks, achievements, and mastery tracking all flow through the unmodified, engine-agnostic `/complete` route exactly as they do for the other 6 ACTIVE engines. A wrong answer costs shields and opens a brief, auto-dismissing, non-blocking "recovery" beat (`RecoveryBanner.tsx`) — it never ends the mission, sends the ship backward, or locks the player out, satisfying the "never humiliating or overly punitive" requirement (verified explicitly: shields bottom out at exactly 0, `missionComplete` stays `false` regardless of shield level). Visually distinct from every other engine: a vertical starfield flight path (not Racing's horizontal lanes or Treasure Quest's room grid), full `useGameV2Motion` reduced-motion support throughout. Wired into `PlaySessionClient.tsx`'s engine-branch dispatch. `scripts/verify-gameroom-v2-space-mission.ts` (42 assertions: route ordering/reachability, difficulty economics, streak-bonus determinism, shield recharge/damage bounds, recovery-never-blocks-progress, mission completion) passes; promoted `BETA → ACTIVE` in the registry only after that script plus the full `verify-gameroom-v2-*.ts` suite, `tsc --noEmit`, `npm run lint`, and `npm run build` all passed clean.
- [x] **Kingdom Builder** — shipped. `lib/gameRoomV2/kingdomBuilder/{resources,buildings,difficulty,kingdom}.ts` (four generic fantasy resources — coins/wood/stone/stars, deterministically earned, never religious in framing; a fixed 6-building construction sequence — house → garden → farm → tower → an explicitly non-religious "Ornamental Pavilion" (a kolam-arched decorative structure, purely cosmetic, no special power) → castle; Settler/Builder/Architect difficulty tiers altering only resource multiplier/wrong-answer cost, never question difficulty; auto-construction the instant a building becomes affordable, so answering correctly is the entire build mechanic) + `components/gameRoomV2/kingdomBuilder/{KingdomBuilderGame,KingdomSetupPicker,KingdomScene,ResourceBar,SetbackBanner,KingdomCompleteScreen}.tsx`. Built around the shared `useGameSessionState`/`QuestionOverlay`/`GameHUD`/`GameResultsScreen` framework from Phase 3.5 — session persistence, scoring, XP/coins, streaks, achievements, and mastery tracking all flow through the unmodified, engine-agnostic `/complete` route exactly as for every other ACTIVE engine. The scene (`KingdomScene.tsx`) is pure CSS/SVG/emoji with no image assets — a gradient sky/ground, an SVG hill silhouette, and buildings placed at fixed plot coordinates that pop in with a spring animation the moment they're constructed; correct-answer streaks unlock a purely cosmetic glow-intensity tier (`streakUpgradeTier`, capped at tier 3) with zero gameplay-mechanical effect, so breaking a streak never costs progress, only shine. A wrong answer never removes a standing building — verified explicitly: `applyWrongAnswer` can only ever spend resources saved toward the *next* building, and 10 consecutive wrong answers in the verify script leave every already-built structure untouched — and opens a brief, auto-dismissing, non-blocking `SetbackBanner` (same non-punitive pattern as Space Mission's `RecoveryBanner`). Full `useGameV2Motion` reduced-motion support; `ResourceBar` resource counts are individually `aria-label`led for screen readers. Wired into `PlaySessionClient.tsx`'s engine-branch dispatch. `scripts/verify-gameroom-v2-kingdom-builder.ts` (63 assertions: build-order well-formedness plus an explicit scan confirming no building name/description contains any religious term, resource economics, difficulty settings, streak-tier bounds, auto-construction, wrong-answer non-destructiveness, streak-break recovery, and full-kingdom completion) passes; promoted `BETA → ACTIVE` in the registry only after that script plus the full `verify-gameroom-v2-*.ts` suite, `tsc --noEmit`, `npm run lint`, and `npm run build` all passed clean.
- [x] **Mystery Mansion** — shipped. `lib/gameRoomV2/mysteryMansion/{rooms,templates,generator,difficulty,investigation}.ts` (a fixed 6-room mansion — entrance → library → study → gallery → attic → garden, matching the spec's suggested areas exactly; a small, reusable, data-only "mystery template" system — 4 lighthearted templates, e.g. a misplaced locket/painting/diary/key, each resolving harmlessly with nobody ever having stolen anything, deliberately NOT a branching narrative engine per the "avoid unnecessarily complex narrative engine" constraint; a deterministic seeded generator (`generateMystery(seed)`, mulberry32 PRNG, no `Math.random()`) that picks one template + suspect + resolution room + one clue phrase per room from the session's own id — the same session id always regenerates the identical mystery (so a page refresh mid-case doesn't switch cases underfoot), while a fresh session/replay against the same Question Set produces a genuinely different case; Junior/Detective/Master Detective difficulty tiers altering only whether a wrong answer costs a "lead" token, never question difficulty) + `components/gameRoomV2/mysteryMansion/{MysteryMansionGame,MysterySetupPicker,RoomView,ClueInventory,SetbackBanner,MysteryResolvedScreen}.tsx`. Built around the shared `useGameSessionState`/`QuestionOverlay`/`GameHUD`/`GameResultsScreen` framework from Phase 3.5 — session persistence, scoring, XP/coins, streaks, achievements, and mastery tracking all flow through the unmodified, engine-agnostic `/complete` route exactly as for every other ACTIVE engine. Tone is explicitly mysterious-and-adventurous, never horror: warm daylight gradients per room (`RoomView.tsx`'s `ROOM_GRADIENT`, never dark/shadowy), friendly ambiance copy, and an automated scan in the verify script confirming no room or mystery text contains any horror-associated term. A wrong answer costs a lead (never below zero) but never moves the student to a different room, never removes an already-found clue, and never re-locks an already-unlocked door — verified explicitly, including that reaching zero leads is never a blocker (there is no failure/lockout state). A one-line bug was caught and fixed during verification: the original clue-collection logic deduplicated by clue TEXT rather than by room id, so two rooms that happened to generate identical phrasing would silently lose one room's clue and permanently stall 100% completion — fixed by tracking `solvedRoomIds` instead and deriving the display list from that, confirmed by the verify script's full-resolution test actually reaching `investigationProgressPct(state) === 100`. Full `useGameV2Motion` reduced-motion support; a compact `ProgressTrail` room-by-room indicator; `ClueInventory` and `RoomView`'s revealed-clue callout are both screen-reader-announced (`role="status"`/`role="group"`). Wired into `PlaySessionClient.tsx`'s engine-branch dispatch. `scripts/verify-gameroom-v2-mystery-mansion.ts` (47 assertions: room sequence, horror-term scan, seeded-generation determinism-vs-variety, difficulty settings, room/clue progression, wrong-answer non-destructiveness, zero-leads-never-blocks, and full mystery resolution including the actual resolution text naming the generated suspect) passes; promoted `BETA → ACTIVE` in the registry only after that script plus the full `verify-gameroom-v2-*.ts` suite, `tsc --noEmit`, `npm run lint`, and `npm run build` all passed clean.
- [x] **Matching** and **Memory** — shipped together, sharing a new reusable card/grid interaction layer built specifically because the request asked for one: `lib/gameRoomV2/cardGrid/cards.ts` (`buildCardsFromMatchPayload(left, right)` reconstructs pair relationships from a MATCH question's already-shuffled, already-answer-stripped `payload.left`/`payload.right` — exactly as delivered by `sessions/[id]/state/route.ts`'s existing MATCH case — by index, before either side is shuffled again for grid display, so no question content or pair relationship is ever duplicated or re-authored; `shuffledWithSeed` — deterministic Fisher-Yates, same seed-determinism pattern as Mystery Mansion's generator; `gridColumnsForCardCount` — shared responsive column-count rules) + `components/gameRoomV2/cardGrid/{FlipCard,CardGrid}.tsx` (a real `<button>` per card — mouse click, touch tap, and keyboard Tab+Enter all activate it identically, satisfying "always provide an accessible tap/click alternative" without needing a separate drag/drop implementation at all; a 3D flip transition, skipped instantly under reduced motion). Both engines compose this exact same layer with genuinely different round logic on top, keeping them behaviorally distinct as required:
  - **Matching** (`lib/gameRoomV2/matching/{round,difficulty}.ts`, `components/gameRoomV2/matching/{MatchingGame,MatchingSetupPicker,MatchingBoard,MatchingStatsBar}.tsx`): every card is always face-up (`FlipCard`'s `faceUp` permanently `true` — nothing to remember, the challenge is purely relationship recognition); tapping two cards resolves the attempt instantly, ringing both cards green (matched, locked in) or red (mismatched, briefly, then clears) — the "clear relationship feedback" requirement; Casual/Quick/Speedster difficulty tiers control an optional round timer and streak-bonus size; "progressively harder rounds" is a real, tested mechanic (`roundTimeLimitForIndex`) — each successive MATCH question in the session tightens the timer by 3s per round down to a 12s floor, never punishing (running out of time never fails the round, it just stops decrementing). Submits the exact `Record<left,right>` shape `MatchInput`'s existing dropdown form already submits to the same `/answer` route — `gradeAnswer.ts` needed zero changes.
  - **Memory** (`lib/gameRoomV2/memory/{round,difficulty}.ts`, `components/gameRoomV2/memory/{MemoryGame,MemorySetupPicker,MemoryBoard,MemoryStatsBar}.tsx`): every card starts face-down; flipping is capped at 2 concurrent face-up cards (classic memory rules, `canFlip` enforces this, verified explicitly that a 3rd flip attempt is a no-op); a deliberate pause (`mismatchRevealMs`, longer on Easy) shows both revealed faces before a mismatch flips back — the "flip animation, mismatch feedback, matched state" requirements — verified explicitly that a mismatch never un-matches an already-matched pair, only resets streak/counts a move; Easy/Medium/Hard scale the mismatch-reveal duration and streak bonus; deliberately has **no round timer** (documented rationale: recall games reward careful memorization, a countdown would work against the mechanic) — "timer where appropriate" is satisfied by Memory correctly being the case where a timer is NOT appropriate, not by adding one anyway. Same `Record<left,right>` submission contract as Matching, same zero changes to `gradeAnswer.ts`.

  Both built around the shared `useGameSessionState`/`GameResultsScreen` framework from Phase 3.5 for session lifecycle/pause/exit/completion (though — like Word Ninja before them — neither mounts `QuestionOverlay`/`QuestionInput` for the actual answering moment, since the grid interaction IS the answering moment; both submit directly to `/answer` the same way Word Ninja's lane-slash submission does), so session persistence, scoring, XP/coins, progression, achievements, and mastery tracking are unchanged, engine-agnostic paths. `scripts/verify-gameroom-v2-card-grid.ts` (15 assertions: pair reconstruction correctness, deterministic shuffling, grid sizing) + `scripts/verify-gameroom-v2-matching.ts` (32 assertions: round creation, correct/incorrect selection, reselection/already-matched guards, full completion, submission contract, difficulty, progressive round scaling) + `scripts/verify-gameroom-v2-memory.ts` (37 assertions: face-down start, 2-card flip cap, match/mismatch resolution, matched-state permanence, mismatch never regressing prior progress, submission contract, no-timer difficulty) all pass; both promoted `BETA → ACTIVE` in the registry only after their scripts plus the full `verify-gameroom-v2-*.ts` suite, `tsc --noEmit`, `npm run lint`, and `npm run build` all passed clean. (One test-authoring bug — not an implementation bug — was caught and fixed while writing Matching's verify script: an early draft assumed the wrong left/right pairing for a seeded shuffle and asserted against it; corrected to assert against the actual generated `pairId` relationships instead.)
- [ ] Crossword: component, grid-fill logic, verify script

Crossword remains; it's the last of the originally-scoped six remaining engines.

**Acceptance criteria (per engine):** `status` flips to `ACTIVE` only once a full play loop (start → render question → submit answer → score → complete/reward) is verified end-to-end by a new `scripts/verify-gameroom-v2-<engine>.ts`, mirroring the existing ACTIVE engines' verify scripts.

---

## Phase 5: Test coverage gaps

Existing scripts: `verify-gameroom-v2-{isolation,domain,gameplay,question-validation,library,progression,learning-analytics,live-classroom,tower-defense,racing,boss-battle,treasure-quest,word-ninja,shared-framework,space-mission,kingdom-builder,mystery-mansion,card-grid,matching,memory}.ts` — 20 total, all passing.

No dedicated verify script exists for:
- [ ] Question Set **Builder** UI/validation flow specifically (partially covered indirectly by `verify-gameroom-v2-question-validation.ts`, but no script exercises `BuilderWizard.tsx`'s multi-step flow or `TamilTextInput`/`QuestionTypeEditor` behavior)
- [ ] `app/api/gameroom-v2/question-sets/**` routes (list/get/duplicate/favorite/usage/assign) — no `verify-gameroom-v2-question-sets-api.ts`
- [ ] `app/api/gameroom-v2/analytics/teacher/route.ts` (teacher-facing analytics dashboard query) — `verify-gameroom-v2-learning-analytics.ts` covers the underlying `lib/gameRoomV2/analytics/*` functions but not this route's aggregation/response shape
- [ ] Live Classroom's **RPC-level** authorization (the Phase 0 gap) — no script asserts a non-host caller is rejected

**Acceptance criteria:** Each item above has a corresponding `scripts/verify-gameroom-v2-*.ts` that passes.

---

## Phase 6: Security/RLS hardening items found

- [ ] **P0 (see Phase 0):** `sms_gamev2_start_live_session`/`pause`/`resume`/`end` lack `REVOKE` + internal ownership checks (migration 079, lines 301-415)
- [ ] `requireGameV2Session` (`lib/gameRoomV2/requireSession.ts`) wraps plain `requireStudent()` and does **not** re-check `sms_gamev2_testers` membership, unlike `requireGameV2Access`/`requireGameV2Teacher`. Routes using it directly or via `requireStudent()` alone — `app/api/gameroom-v2/sessions/start/route.ts`, `app/api/gameroom-v2/analytics/student-challenge/route.ts`, `app/api/gameroom-v2/progression/route.ts`, `app/api/gameroom-v2/live/join/route.ts` — are reachable by **any active student**, not just allowlisted testers, since the corresponding RLS policies (`gamev2_sessions: student manage own`, etc., migration 076) also don't check tester membership. This is a soft-launch gating gap: the UI pages enforce the allowlist, but the API layer doesn't independently.
  - [ ] Either add a tester-allowlist check inside these 4 routes/guard, or explicitly document that gameplay API routes are intentionally open to all students once they have a valid session (only the UI entry point is gated) and confirm that's the intended security posture
- [ ] `app/api/gameroom-v2/question-sets/route.ts` has no pagination (`select(...)` with no `.range()`/`.limit()` on the main question-sets query, only the secondary usage-history query is capped at 200) — low risk today, becomes a real cost/latency issue as the library grows

**Acceptance criteria:** Each item has an explicit decision (fixed, or documented as accepted risk with reasoning) before any rollout authorization.

---

## Phase 7: Mobile/tablet responsiveness fixes

Spot-checked `components/gameRoomV2/racing/Track.tsx`, `components/gameRoomV2/towerDefense/Battlefield.tsx`, and the Word Ninja/Boss Battle visual components: no fixed pixel widths or non-responsive layout patterns were found (Tailwind relative-unit classes throughout). No violations found in this pass, but this needs **hands-on device/viewport testing**, not just static grep, since these are canvas-like/drag-interaction UIs:

- [ ] Manually test Racing, Boss Battle, Tower Defense, Word Ninja at phone width (~375-400px) and tablet width (~768px) on real devices or emulators
- [ ] Confirm touch targets (slash gesture in Word Ninja, tower placement in Tower Defense) are usable on small touchscreens, not just mouse-sized
- [ ] Confirm no horizontal scroll/overflow on any game screen at narrow widths

**Acceptance criteria:** Each of the 4 visually complex engines is confirmed playable end-to-end on a real or emulated phone-width viewport.

---

## Phase 8: Tamil Unicode/accessibility fixes

**Tamil Unicode:** `components/gameRoomV2/builder/TamilTextInput.tsx` passes Unicode straight through with no transliteration/normalization/stripping (by design, per its header comment) and sets `lang="ta"` + Tamil-tuned typography. `lib/gameRoomV2/gradeAnswer.ts`'s `TEXT_INPUT`/`FILL_BLANK` grading uses `.trim().toLowerCase()`, which is a safe no-op on Tamil script (no case folding risk). No Latin-only regex or grapheme-miscounting truncation logic was found. This area looks solid; no action items found in this pass beyond:
- [ ] Confirm no character-count-based validation elsewhere in the Builder (e.g. title/description max-length) miscounts Tamil combining sequences as multiple characters — spot check `MetadataStep.tsx`'s length limits with real Tamil input

**Accessibility:** No `aria-*` (beyond one decorative `aria-hidden`), `role=`, or keyboard handlers (`onKeyDown`, `tabIndex`) were found anywhere under `components/gameRoomV2/`. Every interactive game surface (Word Ninja's slash, Racing, Boss Battle, Tower Defense) is mouse/touch-only with no keyboard path.

- [ ] Add keyboard alternative for Word Ninja's slash interaction (e.g. arrow keys + Enter to select a lane per word)
- [ ] Add keyboard alternative for Tower Defense's tower placement/targeting
- [ ] Add `aria-live` regions for score/HP/streak updates so screen reader users get feedback during gameplay
- [ ] Add `role="img"`/`alt` equivalents for icon-only UI (avatars, badges, status pills)
- [ ] Baseline accessibility audit (axe or manual) across all ACTIVE engines and the Builder/Library screens

**Acceptance criteria:** Each ACTIVE engine has at least one non-mouse input path; automated accessibility scan shows no critical violations on Builder/Library/Home screens.

---

## Phase 9: Performance fixes

- [ ] `app/api/gameroom-v2/question-sets/route.ts` (lines 59-65): usage-count fetch issues one `supabase.rpc()` call per distinct question set id in parallel (`Promise.all(setIds.map(...))`) rather than a single batched/aggregated query — replace with one RPC call taking an array of ids, or a joined query
- [ ] Add pagination (`.range()`) to `app/api/gameroom-v2/question-sets/route.ts`'s main list query
- [ ] Re-verify no N+1 patterns emerge in `app/api/gameroom-v2/analytics/teacher/route.ts` as real usage data grows (not flagged today, but is the route most likely to scale poorly)

No missing `useEffect` cleanup was found — all `setInterval` usages in `BossBattleGame.tsx`, `RacingGame.tsx`, `TowerDefenseGame.tsx`, `TreasureQuestGame.tsx`, `WordNinjaGame.tsx`, and `GameSessionRuntime.tsx` have matching `clearInterval` on unmount.

**Acceptance criteria:** Question-sets list route issues a bounded, constant number of queries regardless of library size; pagination confirmed working with a library of 200+ sets.

---

## Phase 10: Production readiness / QA / rollout checklist

This phase is **not** "add nav link" — it is about the feature being ready when rollout is separately authorized.

- [ ] Phase 0 (P0 security) resolved and verified
- [ ] Phase 1 (registry reconciliation) resolved — no engine's declared compatibility overstates its real behavior
- [ ] Phase 6 (RLS/gating hardening) items resolved or explicitly accepted
- [ ] Phase 7 (mobile) and Phase 8 (accessibility) baseline items resolved for all ACTIVE engines
- [ ] All `scripts/verify-gameroom-v2-*.ts` passing (currently: 20/20 passing)
- [ ] `tsc --noEmit` and `npm run lint` clean (currently: both clean)
- [ ] Isolation re-confirmed via `scripts/verify-gameroom-v2-isolation.ts` immediately before any rollout decision
- [ ] Explicit, separate sign-off obtained before adding any production navigation link or removing/loosening the `sms_gamev2_testers` allowlist gate

**Acceptance criteria:** Every item above checked off, with the isolation script run one final time on the exact commit being considered for rollout.
