-- =====================================================
-- 085: GAMEROOM V2 PUBLIC RELEASE
--
-- Removes the development-only tester requirement from the ONE RLS
-- policy that had it: students reading published Question Set METADATA
-- (title/types/count -- never questions or answers; students have no
-- direct read on sms_gamev2_questions since 083). Everything else is
-- unchanged: still student-role only, still published sets only, and the
-- student API additionally filters to the student's own classes.
--
-- The tester allowlist itself (sms_gamev2_testers) is kept: the app
-- falls back to it if V2 is rolled back with GAMEROOM_V2_ENABLED=false
-- (lib/gameRoomV2/release.ts). Additive/replace-only; no data touched.
-- =====================================================
DROP POLICY IF EXISTS "gamev2_question_sets: student tester read published" ON sms_gamev2_question_sets;
DROP POLICY IF EXISTS "gamev2_question_sets: student read published" ON sms_gamev2_question_sets;
CREATE POLICY "gamev2_question_sets: student read published" ON sms_gamev2_question_sets
  FOR SELECT USING (
    published = true
    AND sms_current_role() = 'student'
  );
