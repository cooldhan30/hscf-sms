-- 090: school calendar for everyone + holidays mark attendance by default.
--
-- sms_calendar_events (013) had no type and was admin-only, so nothing
-- outside Settings ever showed it. This migration:
--   1. adds event_type ('holiday' | 'exam' | 'event');
--   2. lets any signed-in user read it (students/parents/teachers see it
--      on their attendance calendars);
--   3. makes a HOLIDAY mark attendance as 'holiday' for every active
--      enrollment in a class that meets that weekday -- when the holiday
--      is added, and for a student who enrolls later (future holidays).
--      ON CONFLICT DO NOTHING: attendance a teacher already took is never
--      overwritten. 'holiday' rows are already excluded from attendance
--      percentages (069);
--   4. loads the 2026-2027 Tamil School Calendar.

ALTER TABLE sms_calendar_events
  ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'event';
ALTER TABLE sms_calendar_events DROP CONSTRAINT IF EXISTS sms_calendar_events_event_type_check;
ALTER TABLE sms_calendar_events ADD CONSTRAINT sms_calendar_events_event_type_check
  CHECK (event_type IN ('holiday', 'exam', 'event'));

DROP POLICY IF EXISTS "calendar_events: authenticated read" ON sms_calendar_events;
CREATE POLICY "calendar_events: authenticated read" ON sms_calendar_events
  FOR SELECT USING (sms_current_user_id() IS NOT NULL);

-- Marks 'holiday' for active enrollments on every calendar holiday in
-- [p_from, p_to], optionally for one enrollment only. A class with no
-- schedule_day is treated as meeting every day.
CREATE OR REPLACE FUNCTION sms_apply_holiday_attendance(p_from date, p_to date, p_class_id uuid DEFAULT NULL, p_student_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  INSERT INTO sms_attendance (class_id, student_id, date, status, notes)
  SELECT e.class_id, e.student_id, d::date, 'holiday', h.title
  FROM sms_calendar_events h
  CROSS JOIN LATERAL generate_series(greatest(h.event_date, p_from), least(coalesce(h.end_date, h.event_date), p_to), interval '1 day') d
  JOIN sms_class_enrollments e ON e.status = 'active'
  JOIN sms_classes c ON c.id = e.class_id
  WHERE h.event_type = 'holiday'
    AND (p_class_id IS NULL OR e.class_id = p_class_id)
    AND (p_student_id IS NULL OR e.student_id = p_student_id)
    AND (c.schedule_day IS NULL OR lower(c.schedule_day) = lower(trim(to_char(d, 'Day'))))
  ON CONFLICT (class_id, student_id, date) DO NOTHING;
$$;

REVOKE ALL ON FUNCTION sms_apply_holiday_attendance(date, date, uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION sms_calendar_holiday_attendance_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.event_type = 'holiday' THEN
    PERFORM sms_apply_holiday_attendance(NEW.event_date, coalesce(NEW.end_date, NEW.event_date));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sms_calendar_holiday_attendance ON sms_calendar_events;
CREATE TRIGGER trg_sms_calendar_holiday_attendance
  AFTER INSERT OR UPDATE OF event_type, event_date, end_date ON sms_calendar_events
  FOR EACH ROW EXECUTE FUNCTION sms_calendar_holiday_attendance_trigger();

-- A student who joins (or is approved into) a class later gets the
-- class's upcoming holidays too. Past days are left for the teacher.
CREATE OR REPLACE FUNCTION sms_enrollment_holiday_attendance_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'active' THEN
    PERFORM sms_apply_holiday_attendance(current_date, 'infinity'::date, NEW.class_id, NEW.student_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sms_enrollment_holiday_attendance ON sms_class_enrollments;
CREATE TRIGGER trg_sms_enrollment_holiday_attendance
  AFTER INSERT OR UPDATE OF status ON sms_class_enrollments
  FOR EACH ROW EXECUTE FUNCTION sms_enrollment_holiday_attendance_trigger();

-- 2026-2027 Tamil School Calendar. Idempotent (title + date); the insert
-- trigger above marks the holiday attendance.
INSERT INTO sms_calendar_events (title, event_date, event_type, description)
SELECT v.title, v.event_date::date, v.event_type, v.description
FROM (VALUES
  ('Labor Day Weekend',     '2026-09-06', 'holiday', 'No school'),
  ('Deepavali',             '2026-11-08', 'holiday', 'No school'),
  ('Thanksgiving Weekend',  '2026-11-29', 'holiday', 'No school'),
  ('Christmas Break',       '2026-12-27', 'holiday', 'No school'),
  ('New Year Break',        '2027-01-03', 'holiday', 'No school'),
  ('Spring Break',          '2027-03-21', 'holiday', 'No school'),
  ('First Semester Exams',  '2026-12-06', 'exam',    NULL),
  ('First Semester Exams',  '2026-12-13', 'exam',    NULL),
  ('Second Semester Exams', '2027-03-07', 'exam',    NULL),
  ('Second Semester Exams', '2027-03-14', 'exam',    NULL),
  ('Third Semester Exams',  '2027-05-02', 'exam',    NULL),
  ('Third Semester Exams',  '2027-05-09', 'exam',    NULL),
  ('Sange Muzhangu',        '2027-03-28', 'event',   'Annual event (last Sunday of March)'),
  ('Graduation',            '2027-08-29', 'event',   'Annual event (last Sunday of August)')
) AS v(title, event_date, event_type, description)
WHERE NOT EXISTS (
  SELECT 1 FROM sms_calendar_events x WHERE x.title = v.title AND x.event_date = v.event_date::date
);
