-- 089: link assignments back to the saved story they came from.
--
-- Resources already have this (sms_assignments.resource_id, 044), which is
-- how the Resources page flags "already assigned to this class". Stories
-- assigned from Story Generator / My Stories were copied in as plain
-- title + description with no link, so My Stories couldn't tell a teacher
-- they were about to assign the same story to the same class twice.
--
-- ON DELETE SET NULL: deleting a saved story must not delete the
-- assignment students are working on -- it just loses the link.

ALTER TABLE sms_assignments
  ADD COLUMN IF NOT EXISTS story_id UUID REFERENCES sms_teacher_stories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sms_assignments_story_id ON sms_assignments(story_id) WHERE story_id IS NOT NULL;

-- Backfill story assignments made before this column existed: they were
-- created with title = theme and description = story text by the story's
-- own author. (Checked before writing this: every match is unambiguous.)
UPDATE sms_assignments a
SET story_id = s.id
FROM sms_teacher_stories s
WHERE a.story_id IS NULL
  AND a.resource_id IS NULL
  AND a.title = s.theme
  AND a.description = s.story
  AND a.created_by = s.created_by;
