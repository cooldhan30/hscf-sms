-- =====================================================
-- 037: SOFT-DELETE FOR PROFILES
--
-- "Delete" on a teacher (or any profile) used to be a hard DELETE,
-- blocked outright once they had attendance/assignment/grade/
-- announcement history (FK 23503) -- see app/api/admin/teachers/[id]
-- /route.ts. The school wants deletion to just retire the account:
-- keep every historical record, but move the person out of the active
-- list into a separate "Deleted" view, restorable later.
--
-- deleted_at sits alongside the existing is_active flag rather than
-- replacing it: a soft-deleted profile always has is_active = false
-- (deletion implies disabled), but a merely-disabled profile keeps
-- deleted_at NULL. That's what lets the UI tell "disabled" and
-- "deleted" apart.
-- =====================================================

ALTER TABLE sms_profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
