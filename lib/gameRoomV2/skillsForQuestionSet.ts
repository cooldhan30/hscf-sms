// Derives the "skill(s)" a question set's questions exercise, for the
// mastery-analytics architecture (sms_gamev2_skill_practice, migration
// 076). Deliberately simple for now: a set's own subject/topic/tags ARE
// its skills -- there is no separate skill taxonomy yet. A real mastery
// system would likely want a curated skill vocabulary distinct from
// free-text tags, but that's future work; this just needs to log
// SOMETHING meaningful today so the analytics table isn't empty by
// construction once a real report is built on it.
export function skillsForQuestionSet(set: { subject: string | null; topic: string | null; tags: string[] }): string[] {
  const skills = new Set<string>()
  if (set.subject) skills.add(set.subject)
  if (set.topic) skills.add(set.topic)
  // 'sys:' tags are internal markers (built-in content sync), not skills.
  set.tags.filter((t) => !t.startsWith('sys:')).forEach((t) => skills.add(t))
  return Array.from(skills)
}
