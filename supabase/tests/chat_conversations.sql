-- Chat regression test (migration 087). Run AFTER 087 is applied, e.g. in
-- the Supabase SQL editor or via the MCP execute_sql tool. It ALWAYS rolls
-- back: it finishes by raising 'CHAT REGRESSION PASSED {...}' or
-- 'CHAT REGRESSION FAILED {...}', so nothing it creates is ever kept.
--
-- Fill in four real profile ids before running:
--   :teacher  -- a teacher
--   :student  -- a student enrolled in one of that teacher's classes
--   :student2 -- another student in one of that teacher's classes
--   :outsider -- a student with no relationship to the teacher
DO $t$
DECLARE
  ua text := ':teacher'; ub text := ':student'; ud text := ':student2'; uc text := ':outsider';
  r jsonb := '{}'; id1 uuid; id2 uuid; id3 uuid; g uuid; v int; v_txt text; ok boolean;
BEGIN
  IF NOT sms_can_chat(ua, ub) OR NOT sms_can_chat(ua, ud) OR sms_can_chat(ua, uc) THEN
    RAISE EXCEPTION 'CHAT REGRESSION SETUP: pick ids where teacher can chat with both students and not with the outsider';
  END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', ua, 'role','authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  id1 := sms_get_or_create_direct_conversation(ub);                                  -- A -> B (new)
  SELECT string_agg(p.user_id, ',' ORDER BY p.user_id) INTO v_txt FROM sms_conversation_participants p WHERE p.conversation_id = id1;
  r := r || jsonb_build_object('new_pair_exact_members', v_txt = (SELECT string_agg(x, ',' ORDER BY x) FROM unnest(ARRAY[ua,ub]) x));
  r := r || jsonb_build_object('a_to_b_again_same', sms_get_or_create_direct_conversation(ub) = id1);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', ub, 'role','authenticated')::text, true);
  r := r || jsonb_build_object('b_to_a_same', sms_get_or_create_direct_conversation(ua) = id1);
  BEGIN
    INSERT INTO sms_conversation_participants (conversation_id, user_id) VALUES (id1, ud);
    r := r || jsonb_build_object('no_third_person_in_1to1', false);
  EXCEPTION WHEN others THEN r := r || jsonb_build_object('no_third_person_in_1to1', true);
  END;
  -- The race-loser path: the pair row already exists (another request won).
  EXECUTE 'RESET ROLE';
  INSERT INTO sms_conversations (user_a, user_b) SELECT least(ua COLLATE "C", ud COLLATE "C"), greatest(ua COLLATE "C", ud COLLATE "C") RETURNING id INTO id2;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', ud, 'role','authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  id3 := sms_get_or_create_direct_conversation(ua);
  SELECT count(*) INTO v FROM sms_conversation_participants p WHERE p.conversation_id = id3;
  r := r || jsonb_build_object('existing_row_reused_and_repaired', id3 = id2 AND v = 2);
  EXECUTE 'RESET ROLE';
  SELECT count(*) INTO v FROM sms_conversations x WHERE x.user_a = least(ua COLLATE "C", ud COLLATE "C") AND x.user_b = greatest(ua COLLATE "C", ud COLLATE "C");
  r := r || jsonb_build_object('one_row_per_pair', v = 1);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', ua, 'role','authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN PERFORM sms_get_or_create_direct_conversation(uc); r := r || '{"unrelated_blocked": false}';
  EXCEPTION WHEN others THEN r := r || '{"unrelated_blocked": true}'; END;
  BEGIN PERFORM sms_get_or_create_direct_conversation(ua); r := r || '{"self_chat_blocked": false}';
  EXCEPTION WHEN others THEN r := r || '{"self_chat_blocked": true}'; END;
  g := sms_create_group_conversation('Regression group', ARRAY[ub, ud, ud, ua]);
  SELECT count(*) INTO v FROM sms_conversation_participants p WHERE p.conversation_id = g;
  r := r || jsonb_build_object('group_members_deduped', v = 3);
  SELECT count(*) INTO v FROM sms_conversations x WHERE x.is_group AND x.created_by = ua;
  BEGIN PERFORM sms_create_group_conversation('Bad', ARRAY[ub, uc]); r := r || '{"group_unrelated_blocked": false}';
  EXCEPTION WHEN others THEN r := r || '{"group_unrelated_blocked": true}'; END;
  r := r || jsonb_build_object('failed_group_left_nothing', (SELECT count(*) FROM sms_conversations x WHERE x.is_group AND x.created_by = ua) = v);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uc, 'role','authenticated')::text, true);
  BEGIN INSERT INTO sms_conversation_participants (conversation_id, user_id) VALUES (id1, uc); r := r || '{"outsider_cannot_join_1to1": false}';
  EXCEPTION WHEN others THEN r := r || '{"outsider_cannot_join_1to1": true}'; END;
  BEGIN INSERT INTO sms_conversation_participants (conversation_id, user_id) VALUES (g, uc); r := r || '{"outsider_cannot_join_group": false}';
  EXCEPTION WHEN others THEN r := r || '{"outsider_cannot_join_group": true}'; END;
  SELECT count(*) INTO v FROM sms_conversations x WHERE x.id IN (id1, g);
  r := r || jsonb_build_object('outsider_cannot_read', v = 0);
  -- Messages: a participant can send/read; an outsider can neither read nor post.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', ua, 'role','authenticated')::text, true);
  INSERT INTO sms_messages (conversation_id, sender_id, content) VALUES (id1, ua, 'regression message');
  SELECT count(*) INTO v FROM sms_messages m WHERE m.conversation_id = id1;
  r := r || jsonb_build_object('participant_can_send_and_read', v = 1);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', ub, 'role','authenticated')::text, true);
  SELECT count(*) INTO v FROM sms_messages m WHERE m.conversation_id = id1;
  r := r || jsonb_build_object('other_participant_reads', v = 1);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uc, 'role','authenticated')::text, true);
  SELECT count(*) INTO v FROM sms_messages m WHERE m.conversation_id IN (id1, g);
  r := r || jsonb_build_object('outsider_cannot_read_messages', v = 0);
  BEGIN INSERT INTO sms_messages (conversation_id, sender_id, content) VALUES (id1, uc, 'x'); r := r || '{"outsider_cannot_post": false}';
  EXCEPTION WHEN others THEN r := r || '{"outsider_cannot_post": true}'; END;
  BEGIN INSERT INTO sms_messages (conversation_id, sender_id, content) VALUES (id1, ua, 'x'); r := r || '{"cannot_post_as_someone_else": false}';
  EXCEPTION WHEN others THEN r := r || '{"cannot_post_as_someone_else": true}'; END;
  -- Group invitations: only a member may invite, and only someone they could chat with.
  BEGIN INSERT INTO sms_conversation_participants (conversation_id, user_id) VALUES (g, ub); r := r || '{"non_member_cannot_invite": false}';
  EXCEPTION WHEN others THEN r := r || '{"non_member_cannot_invite": true}'; END;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', ua, 'role','authenticated')::text, true);
  BEGIN INSERT INTO sms_conversation_participants (conversation_id, user_id) VALUES (g, uc); r := r || '{"member_cannot_invite_unrelated": false}';
  EXCEPTION WHEN others THEN r := r || '{"member_cannot_invite_unrelated": true}'; END;
  EXECUTE 'RESET ROLE';
  DELETE FROM sms_conversation_participants p WHERE p.conversation_id = g AND p.user_id = ud;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', ua, 'role','authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN INSERT INTO sms_conversation_participants (conversation_id, user_id) VALUES (g, ud); r := r || '{"member_can_invite_chattable": true}';
  EXCEPTION WHEN others THEN r := r || '{"member_can_invite_chattable": false}'; END;
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  BEGIN PERFORM sms_get_or_create_direct_conversation(ub); r := r || '{"needs_identity": false}';
  EXCEPTION WHEN others THEN r := r || '{"needs_identity": true}'; END;
  EXECUTE 'RESET ROLE';
  EXECUTE 'SET LOCAL ROLE anon';
  BEGIN PERFORM sms_get_or_create_direct_conversation(ub); r := r || '{"anon_call_refused": false}';
  EXCEPTION WHEN insufficient_privilege THEN r := r || '{"anon_call_refused": true}'; END;
  EXECUTE 'RESET ROLE';
  r := r || jsonb_build_object('anon_cannot_execute', NOT has_function_privilege('anon', 'sms_get_or_create_direct_conversation(text)', 'EXECUTE'));
  SELECT bool_and(value::boolean) INTO ok FROM jsonb_each_text(r);
  IF ok THEN RAISE EXCEPTION 'CHAT REGRESSION PASSED %', r::text;
  ELSE RAISE EXCEPTION 'CHAT REGRESSION FAILED %', r::text; END IF;
END $t$;
