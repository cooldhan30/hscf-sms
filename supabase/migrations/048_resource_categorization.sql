-- =====================================================
-- 048: RESOURCE CATEGORIZATION, LEVELS, SKILLS, TAGS
--
-- Resources had no structured way to organize/filter beyond class_id and
-- a free-typed title -- fine at a handful of files, not at the hundreds
-- the library is expected to grow to. Adds category/subcategory/
-- difficulty/format as single-select TEXT columns (validated in code
-- against lib/resourceTaxonomy.ts, not a DB enum/check constraint --
-- adding a new subcategory later should be a one-line constant change,
-- not a migration) and levels/skills/tags as TEXT[] since a resource can
-- reasonably apply to more than one grade level, skill, or tag at once
-- (same array-column shape already used by
-- sms_assignments.allow_submission_types).
--
-- Existing resources get category/subcategory left NULL (rendered as
-- "Uncategorized" client-side via lib/resourceTaxonomy.ts's
-- categoryLabel()) rather than force-guessed into a category from title
-- text alone -- a wrong guess is worse than an honest "needs review"
-- state, and nothing about existing resources' visibility/access
-- changes just because they're uncategorized.
-- =====================================================

ALTER TABLE sms_resources
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS subcategory TEXT,
  ADD COLUMN IF NOT EXISTS difficulty TEXT CHECK (difficulty IS NULL OR difficulty IN ('easy', 'medium', 'hard')),
  ADD COLUMN IF NOT EXISTS format TEXT,
  ADD COLUMN IF NOT EXISTS levels TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS skills TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

-- GIN indexes for the array columns -- filtering "levels @> ARRAY['grade-3']"
-- style queries would otherwise be a sequential scan once the library is
-- large enough for this feature to matter in the first place.
CREATE INDEX IF NOT EXISTS idx_sms_resources_levels ON sms_resources USING GIN (levels);
CREATE INDEX IF NOT EXISTS idx_sms_resources_skills ON sms_resources USING GIN (skills);
CREATE INDEX IF NOT EXISTS idx_sms_resources_tags ON sms_resources USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_sms_resources_category ON sms_resources (category);

-- Existing "teacher manage own" UPDATE policy (043) already covers PATCH
-- for these new columns -- no RLS change needed, this is additive data
-- on a row teachers could already update.
