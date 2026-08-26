-- =====================================================
-- 062: GAME ROOM -- interactive game kind
--
-- Distinguishes the existing single-select-multiple-choice quiz engine
-- from new solo interactive games (drag-order, memory-match) purely so
-- app/student/game-room/[sessionId]/page.tsx knows which client
-- component to render. Defaults to 'quiz' so every existing row/route
-- is completely unaffected -- no other column changes, no new tables:
-- an interactive game's board state is never persisted mid-play (lives
-- entirely in client React state), only the final score/completion is
-- written once via /api/game-room/interactive/complete, reusing
-- sms_game_players' existing score/completed/completed_at columns
-- exactly like a solo quiz practice run already does.
-- =====================================================

ALTER TABLE sms_game_sessions ADD COLUMN IF NOT EXISTS game_kind TEXT NOT NULL DEFAULT 'quiz' CHECK (game_kind IN ('quiz', 'interactive'));
