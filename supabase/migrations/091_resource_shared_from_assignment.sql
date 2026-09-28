-- 091: remember which assignment a Story Generator resource was shared from.
--
-- Assigning a generated story also copies it into the Resources library
-- (shareAsResource, app/api/teacher/assignments). The copy had no link
-- back, so the Resources page showed it as not assigned and invited the
-- teacher to assign the same story to the same class again. Linking the
-- ASSIGNMENT to the resource (resource_id) isn't an option: the student's
-- assignment page renders a linked resource above the assignment, which
-- for a story would show the illustration and text twice. So the link
-- lives on the resource instead.

ALTER TABLE sms_resources
  ADD COLUMN IF NOT EXISTS shared_from_assignment_id UUID REFERENCES sms_assignments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sms_resources_shared_from_assignment
  ON sms_resources(shared_from_assignment_id) WHERE shared_from_assignment_id IS NOT NULL;

-- Backfill: a shared story resource is created in the same request as its
-- assignment -- same author and title, image or story text copied over,
-- seconds apart. (Checked before writing this: 7 matches, none ambiguous.)
UPDATE sms_resources r
SET shared_from_assignment_id = m.assignment_id
FROM (
  SELECT DISTINCT ON (r2.id) r2.id AS resource_id, a.id AS assignment_id
  FROM sms_resources r2
  JOIN sms_assignments a
    ON a.created_by = r2.created_by
   AND a.title = r2.title
   AND a.resource_id IS NULL
   AND (a.image_url = r2.file_url OR a.description = r2.description OR r2.description = 'Story generated with the Story Generator.')
   AND abs(extract(epoch FROM (a.created_at - r2.created_at))) < 120
  WHERE r2.class_id IS NULL
    AND r2.subcategory = 'reading-exercises'
    AND r2.shared_from_assignment_id IS NULL
  ORDER BY r2.id, abs(extract(epoch FROM (a.created_at - r2.created_at)))
) m
WHERE r.id = m.resource_id;
