-- =====================================================
-- FIX: 024's fix leaked pending-request classes into every OTHER
-- unscoped sms_classes read (e.g. the teacher dashboard's "Upcoming
-- Classes"), not just the "Your requests" list it was meant for
-- =====================================================
-- 024 added row-level SELECT policies granting full-row sms_classes
-- access to any teacher/student with a request against that class.
-- RLS is inherently row-level, not column- or query-scoped -- so ANY
-- unscoped `select * from sms_classes` anywhere in the app (e.g.
-- app/teacher/page.tsx's dashboard query, which has no explicit
-- teacher_id filter and relies entirely on RLS to scope "my classes")
-- picked up these rows too, making a class the teacher merely
-- REQUESTED (not yet approved for) appear as if they already teach it.
--
-- Fix: drop those two broad policies entirely. Replace with narrow
-- SECURITY DEFINER functions that return only the caller's own
-- pending/denied requests joined with just the class name -- nothing
-- else reads through this path, so nothing else can leak through it.
-- =====================================================

DROP POLICY IF EXISTS "classes: teacher read requested" ON sms_classes;
DROP POLICY IF EXISTS "classes: student read requested" ON sms_classes;
DROP FUNCTION IF EXISTS sms_teacher_has_class_teacher_request(UUID);
DROP FUNCTION IF EXISTS sms_student_has_class_join_request(UUID);

CREATE OR REPLACE FUNCTION sms_my_teacher_class_requests()
RETURNS TABLE (id UUID, class_id UUID, class_name TEXT, status TEXT, requested_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ctr.id, ctr.class_id, c.name, ctr.status, ctr.requested_at
  FROM sms_class_teacher_requests ctr
  JOIN sms_classes c ON c.id = ctr.class_id
  JOIN sms_teachers t ON t.id = ctr.teacher_id
  WHERE t.profile_id = sms_current_user_id() AND ctr.status IN ('pending', 'denied');
$$;

CREATE OR REPLACE FUNCTION sms_my_student_class_requests()
RETURNS TABLE (id UUID, class_id UUID, class_name TEXT, status TEXT, requested_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jr.id, jr.class_id, c.name, jr.status, jr.requested_at
  FROM sms_class_join_requests jr
  JOIN sms_classes c ON c.id = jr.class_id
  JOIN sms_students s ON s.id = jr.student_id
  WHERE s.profile_id = sms_current_user_id() AND jr.status IN ('pending', 'denied');
$$;
