-- =====================================================
-- FIX: teacher directory read didn't extend to sms_profiles
-- =====================================================
-- Phase 1 added "teachers: authenticated read" on sms_teachers
-- specifically so any signed-in user could see the teacher
-- directory (name/specialty). But a teacher's actual name
-- lives in sms_profiles, and no policy there let anyone but
-- the profile's own owner (or an admin) read it -- so nested
-- embeds like sms_classes -> teacher:sms_teachers -> profile
-- came back with profile: null for students/parents, crashing
-- any page that rendered the teacher's name. Confirmed live:
-- /student/classes 500'd on c.teacher.profile.first_name.
-- =====================================================

CREATE POLICY "profiles: authenticated read teacher directory" ON sms_profiles
  FOR SELECT USING (role = 'teacher');
