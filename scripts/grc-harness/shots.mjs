// Screenshots of the GameRoom Classic prototype at desktop/laptop/iPad/phone,
// including played-through flows. It proves screens render, fit and can be
// clicked through; whether they look right is for a person to judge.
//   npm i --no-save playwright-core   (uses the installed Chrome)
//   node scripts/grc-harness/shots.mjs <outDir>
import { execFileSync } from 'child_process'
import { createServer } from 'http'
import { mkdirSync, readFileSync, existsSync, writeFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const outDir = path.resolve(process.argv[2] ?? path.join(root, '.grc-harness'))
const site = path.join(outDir, 'site')
const shots = path.join(outDir, 'shots')
mkdirSync(shots, { recursive: true })
execFileSync(process.execPath, [path.join(root, 'scripts/grc-harness/build.mjs'), site], { stdio: 'inherit' })

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }
const server = createServer((req, res) => {
  const rel = decodeURIComponent((req.url || '/').split('?')[0]).replace(/^\/$/, '/index.html')
  const p = path.join(site, rel)
  if (!p.startsWith(site) || !existsSync(p)) return res.writeHead(404).end()
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }).end(readFileSync(p))
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const base = `http://127.0.0.1:${server.address().port}/`

const { chromium } = createRequire(import.meta.url)('playwright-core')
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
const VIEWPORTS = [
  { name: 'desktop-1920', width: 1920, height: 1080 },
  { name: 'laptop-1366', width: 1366, height: 768 },
  { name: 'ipad-820', width: 820, height: 1180, touch: true },
  { name: 'phone-390', width: 390, height: 844, touch: true },
]
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7)
const report = { overflow: [], errors: [], flows: {} }
// A teacher's own spreadsheet: 2 good rows (one with a new topic), 1 repeat, 1 broken, 1 already in the library.
const IMPORT_CSV = [
  'topic,question,question_english,answer_1,answer_2,answer_3,answer_4,correct_answer,explanation,difficulty',
  'குறில் / நெடில்,இவற்றில் குறில் எழுத்து எது?,Which is short?,ஒ,ஓ,,,1,குறில்: அ இ உ எ ஒ,easy',
  'பால்,"""அவள்"" எந்தப் பால்?",,ஆண்பால்,பெண்பால்,பலர்பால்,,2,,medium',
  'பால்,"""அவள்""  எந்தப் பால்?",,ஆண்பால்,பெண்பால்,பலர்பால்,,2,,medium',
  'திணை,இது ஒரு கேள்வி,,ஒரே பதில்,,,,1,,',
  'உயிர் எழுத்துக்கள்,தமிழில் எத்தனை உயிர் எழுத்துக்கள் உள்ளன?,,10,12,18,247,2,,easy',
].join('\n')

async function open(vp, screen) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: !!vp.touch, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => report.errors.push(`${vp.name}/${screen}: ${e.message}`))
  page.on('console', (m) => m.type() === 'error' && report.errors.push(`${vp.name}/${screen} console: ${m.text()}`))
  await page.goto(`${base}?screen=${screen}`)
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(500)
  return { ctx, page }
}
async function shot(page, vp, name) {
  name = name.replace('&empty=1', '-empty').replace('&fail=1', '-fail').replace(/&/g, '-').replace(/=/g, '')
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  if (over > 1) report.overflow.push(`${vp.name}/${name}: ${over}px`)
  await page.screenshot({ path: path.join(shots, `${name}--${vp.name}.png`), fullPage: true })
}
async function flow(name, vp, fn) {
  try {
    await fn()
    report.flows[`${name}/${vp.name}`] = 'ok'
  } catch (e) {
    report.flows[`${name}/${vp.name}`] = `FAILED: ${e.message.split('\n')[0]}`
  }
}

const STATIC = ['home', 'teacher', 'teacher&empty=1', 'library', 'teachers-only', 'teacher-pick-host', 'teacher-assignments', 'create', 'edit', 'assign', 'results', 'student', 'student-assignments', 'review', 'quiz', 'match', 'word', 'sentence', 'join', 'host-setup', 'results-coteacher', 'practice-stats', 'portal-student', 'portal-teacher', 'teacher-quick', 'student-topics', 'topic-practice']
for (const vp of VIEWPORTS) {
  if (only && !vp.name.startsWith(only)) continue
  for (const s of STATIC) {
    const { ctx, page } = await open(vp, s)
    await shot(page, vp, s)
    await ctx.close()
  }

  await flow('practice', vp, async () => {
    const { ctx, page } = await open(vp, 'practice')
    // Tamil prompts are marked as Tamil for screen readers.
    const lang = await page.locator('#grc-question').getAttribute('lang')
    if (lang !== 'ta') throw new Error('question not marked lang=ta')
    await page.getByRole('button', { name: /Hint: remove one wrong answer/ }).click()
    await shot(page, vp, 'flow-practice-hint')
    await page.getByRole('button', { name: 'Answer 2: 12' }).click()
    await page.getByText('சரி! Correct!').waitFor()
    await page.getByRole('button', { name: 'Next →' }).click()
    // Focus moves to the new question.
    await page.waitForTimeout(200)
    const focused = await page.evaluate(() => document.activeElement && document.activeElement.id)
    if (focused !== 'grc-question') throw new Error('focus did not move to the new question: ' + focused)
    for (let i = 1; i < 5; i++) {
      await page.getByRole('button', { name: /^Answer 1:/ }).click()
      await page.getByRole('button', { name: i < 4 ? 'Next →' : 'See my score' }).click()
    }
    await page.getByRole('button', { name: 'Play again' }).waitFor()
    await page.waitForFunction(() => typeof window.__practiceFinished === 'number', null, { timeout: 5000 }).catch(() => {
      throw new Error('practice progress was not sent')
    })
    await shot(page, vp, 'flow-practice-done')
    await ctx.close()
  })
  await flow('practice-switch', vp, async () => {
    const { ctx, page } = await open(vp, 'teacher')
    await page.getByRole('button', { name: 'Practice: Off' }).first().click()
    await page.getByText('can now practise').waitFor()
    await shot(page, vp, 'flow-practice-switch')
    await ctx.close()
  })

  await flow('edit-settings', vp, async () => {
    const { ctx, page } = await open(vp, 'results')
    await page.getByRole('button', { name: /Edit settings/ }).click()
    await page.getByRole('group', { name: 'Attempts', exact: true }).getByRole('button', { name: '3', exact: true }).click()
    await page.getByRole('button', { name: 'Save settings' }).click()
    await page.getByText('Settings saved').waitFor()
    await shot(page, vp, 'flow-edit-settings')
    await ctx.close()
  })
  await flow('coteacher-view-only', vp, async () => {
    const { ctx, page } = await open(vp, 'results-coteacher')
    await page.getByText('Made by Ms. Priya').waitFor()
    for (const name of ['Close', /Edit settings/, /Extend deadline/]) if ((await page.getByRole('button', { name }).count()) > 0) throw new Error('co-teacher sees an owner-only button')
    if ((await page.getByRole('button', { name: /Export CSV/ }).count()) !== 1) throw new Error('co-teacher cannot export')
    await ctx.close()
  })

  await flow('publish', vp, async () => {
    const { ctx, page } = await open(vp, 'assign')
    await page.getByRole('button', { name: /Grade 2 · A/ }).click()
    await page.getByRole('button', { name: 'In 1 week' }).click()
    await page.getByRole('button', { name: /Publish Assignment/ }).click()
    await page.getByText('Assignment published!').waitFor()
    await shot(page, vp, 'flow-assign-published')
    await ctx.close()
  })
  await flow('results-actions', vp, async () => {
    const { ctx, page } = await open(vp, 'results')
    await page.getByRole('button', { name: /Attempt/ }).first().click()
    await page.getByText('can now have one more attempt').waitFor()
    await page.getByRole('button', { name: 'Close' }).click()
    await page.getByText('Assignment closed').waitFor()
    await shot(page, vp, 'flow-results-actions')
    await ctx.close()
  })
  await flow('runner', vp, async () => {
    const { ctx, page } = await open(vp, 'runner')
    await page.getByRole('button', { name: /^Answer 1:/ }).waitFor()
    await shot(page, vp, 'flow-runner-start')
    for (let i = 0; i < 5; i++) {
      await page.getByRole('button', { name: i === 0 ? 'Answer 2: 12' : /^Answer 1:/ }).click()
      await page.getByRole('button', { name: i < 4 ? 'Next →' : 'Finish' }).click()
    }
    await page.getByRole('button', { name: 'Finish & Submit' }).click()
    await page.getByText('Assignment Submitted Successfully!').waitFor()
    await page.waitForTimeout(1500)
    await shot(page, vp, 'flow-runner-submitted')
    await ctx.close()
  })
  await flow('runner-resume', vp, async () => {
    const { ctx, page } = await open(vp, 'runner&resume=2')
    await page.getByText('3 / 5').waitFor()
    await shot(page, vp, 'flow-runner-resume')
    await ctx.close()
  })
  await flow('runner-timer', vp, async () => {
    const { ctx, page } = await open(vp, 'runner&timer=1')
    await page.getByRole('timer').waitFor()
    await shot(page, vp, 'flow-runner-timer')
    await page.getByText('Assignment Submitted Successfully!').waitFor({ timeout: 15000 })
    await ctx.close()
  })
  await flow('runner-closed', vp, async () => {
    const { ctx, page } = await open(vp, 'runner&closed=1')
    await page.getByText('Your teacher has closed this assignment.').waitFor()
    await shot(page, vp, 'flow-runner-closed')
    await ctx.close()
  })
  await flow('runner-submit-retry', vp, async () => {
    const { ctx, page } = await open(vp, 'runner&resume=5&failsubmit=1')
    await page.getByRole('button', { name: 'Finish & Submit' }).click()
    await page.getByRole('alert').waitFor()
    await shot(page, vp, 'flow-runner-submit-failed')
    if ((await page.getByText('Assignment Submitted Successfully!').count()) > 0) throw new Error('showed success after a failed submit')
    await page.getByRole('button', { name: 'Finish & Submit' }).click()
    await page.getByText('Assignment Submitted Successfully!').waitFor()
    await ctx.close()
  })

  await flow('remote-quiz', vp, async () => {
    const { ctx, page } = await open(vp, 'remote-quiz')
    await page.getByRole('button', { name: 'Answer 1: 10' }).click()
    await page.getByText('Answer: 12').waitFor()
    await shot(page, vp, 'flow-remote-quiz-wrong')
    await ctx.close()
  })
  await flow('remote-match', vp, async () => {
    const { ctx, page } = await open(vp, 'remote-match')
    for (const [l, r] of [['பூனை', 'dog'], ['பூனை', 'cat'], ['நாய்', 'dog'], ['பசு', 'cow'], ['யானை', 'elephant']]) {
      await page.getByRole('button', { name: l, exact: true }).click()
      await page.getByRole('button', { name: r, exact: true }).click()
      await page.waitForTimeout(250)
    }
    await page.getByText('3 of 4 right first time').waitFor()
    await shot(page, vp, 'flow-remote-match-done')
    await ctx.close()
  })
  await flow('remote-word', vp, async () => {
    const { ctx, page } = await open(vp, 'remote-word')
    for (const t of ['ம்', 'அ', 'மா']) await page.getByRole('button', { name: `Tile ${t}`, exact: true }).click()
    await page.getByRole('button', { name: 'Check ✓' }).click()
    await page.getByRole('button', { name: 'Show answer' }).click()
    await page.getByText('Answer: அம்மா').waitFor()
    await shot(page, vp, 'flow-remote-word-shown')
    await ctx.close()
  })
  await flow('remote-offline', vp, async () => {
    const { ctx, page } = await open(vp, 'remote-quiz&fail=1')
    await page.getByRole('button', { name: 'Answer 2: 12' }).click()
    await page.getByText("Couldn't send your answer").waitFor()
    await shot(page, vp, 'flow-remote-offline')
    await ctx.close()
  })

  await flow('shared-library', vp, async () => {
    const { ctx, page } = await open(vp, 'library')
    await page.getByText('by Ms. Priya').first().waitFor()
    const all = await page.locator('ul.mt-4 > li').count()
    await shot(page, vp, 'flow-shared-library')
    await page.getByRole('button', { name: 'Only mine' }).click()
    const mine = await page.locator('ul.mt-4 > li').count()
    if (!(mine < all)) throw new Error(`"Only mine" did not narrow the list (${all} -> ${mine})`)
    if ((await page.getByText('by Ms. Priya').count()) > 0) throw new Error('"Only mine" still shows another teacher')
    // Any teacher can edit any question; the editor says whose it is.
    await page.getByRole('button', { name: 'All teachers' }).click()
    const theirs = page.locator('ul.mt-4 > li').filter({ hasText: 'by Ms. Priya' }).first()
    await theirs.getByRole('button', { name: 'Edit' }).click()
    await page.getByText('Ms. Priya wrote this question').waitFor()
    await shot(page, vp, 'flow-shared-library-edit')
    await page.getByRole('button', { name: 'Cancel' }).click()
    await ctx.close()
  })
  await flow('library-to-game', vp, async () => {
    const { ctx, page } = await open(vp, 'library')
    const btn = page.getByRole('link', { name: /Make a Quiz game with these \d+ questions/ })
    const label = await btn.textContent()
    const n = Number(label.match(/(\d+)/)[1])
    await btn.click() // stores the pick, then navigates (the harness has no router, so reopen Create)
    await page.goto(base + '?screen=create&type=quiz')
    await page.getByText(`Questions in this game`).waitFor()
    const count = await page.locator('ol.space-y-2 > li').count() // the game's question list (not the step markers)
    if (count !== n) throw new Error(`expected ${n} questions ticked, got ${count}`)
    if ((await page.getByText('What kind of game?').count()) > 0) throw new Error('went back to choosing a game type')
    await shot(page, vp, 'flow-library-to-game')
    await ctx.close()
  })
  await flow('import-to-game', vp, async () => {
    const { ctx, page } = await open(vp, 'library')
    await page.getByRole('button', { name: 'Import CSV' }).click()
    await page.setInputFiles('#grc-csv', { name: 'q.csv', mimeType: 'text/csv', buffer: Buffer.from(IMPORT_CSV, 'utf8') })
    await page.getByRole('button', { name: /^Import \d+ question/ }).click()
    await page.getByRole('link', { name: /Make a game with these/ }).waitFor()
    await shot(page, vp, 'flow-import-to-game')
    await ctx.close()
  })
  await flow('wrong-type-hint', vp, async () => {
    const { ctx, page } = await open(vp, 'create&onlyquiz=1')
    await page.getByRole('button', { name: /Match the Pairs/ }).click()
    await page.getByText('Each game type uses its own kind of question').waitFor()
    await shot(page, vp, 'flow-wrong-type-hint')
    await page.getByRole('button', { name: /for Classic Quiz — switch/ }).click()
    await page.getByText('Change type (Classic Quiz)').waitFor()
    await ctx.close()
  })

  await flow('library-add', vp, async () => {
    const { ctx, page } = await open(vp, 'library')
    await page.getByRole('button', { name: 'Add question' }).first().click()
    await page.getByLabel('Question', { exact: true }).fill('இவற்றில் உயிர்மெய் எழுத்து எது?')
    await page.getByLabel('Answer 1', { exact: true }).fill('க')
    await page.getByLabel('Answer 2', { exact: true }).fill('கா')
    await page.getByLabel('Answer 2 is right').check()
    await shot(page, vp, 'flow-library-add-form')
    await page.getByRole('button', { name: 'Add question' }).last().click()
    await page.getByText('Question added to your library.').waitFor()
    await shot(page, vp, 'flow-library-added')
    await ctx.close()
  })

  await flow('library-import', vp, async () => {
    const { ctx, page } = await open(vp, 'library')
    await page.getByRole('button', { name: 'Import CSV' }).click()
    await page.setInputFiles('#grc-csv', { name: 'my-questions.csv', mimeType: 'text/csv', buffer: Buffer.from(IMPORT_CSV, 'utf8') })
    await page.getByText('ready', { exact: false }).first().waitFor()
    await shot(page, vp, 'flow-import-preview')
    await page.getByRole('button', { name: /^Import \d+ question/ }).click()
    await page.getByText(/Imported \d+ question/).waitFor()
    await shot(page, vp, 'flow-import-done')
    await ctx.close()
  })

  await flow('quick-setup', vp, async () => {
    const { ctx, page } = await open(vp, 'create')
    await page.getByRole('button', { name: /Classic Quiz/ }).click()
    // Pick the topic with the most quiz questions; the game fills itself.
    const best = await page.locator('#grc-category option').evaluateAll((os) =>
      os.map((o) => ({ value: o.value, n: Number((o.textContent.match(/\((\d+)\)$/) || [])[1] || 0) })).filter((o) => o.value && o.value !== '__new').sort((a, b) => b.n - a.n)[0])
    if (!best || best.n < 2) throw new Error('no topic with quiz questions in the sample library')
    await page.locator('#grc-category').selectOption(best.value)
    const rows = page.locator('ol.space-y-2 > li')
    await page.waitForTimeout(200)
    if ((await rows.count()) !== Math.min(10, best.n)) throw new Error(`topic fill: expected ${Math.min(10, best.n)}, got ${await rows.count()}`)
    if (!(await page.getByLabel('Game name').inputValue())) throw new Error('game name was not filled from the topic')
    await page.getByRole('button', { name: `All ${best.n}` }).click()
    if ((await rows.count()) !== best.n) throw new Error('"All" did not use every question in the topic')
    await page.getByRole('button', { name: '30s' }).click()
    await page.getByText(/Showing “.*” only/).waitFor()
    await page.getByRole('button', { name: 'Save & host live' }).waitFor()
    await shot(page, vp, 'flow-quick-setup')
    // A hand edit stops the automatic fill.
    await rows.first().getByRole('button', { name: 'Remove from game' }).click()
    await page.getByRole('button', { name: `All ${best.n}` }).click()
    if ((await rows.count()) !== best.n - 1) throw new Error('quick setup overwrote a hand-picked list')
    await ctx.close()
  })

  await flow('teacher-quick', vp, async () => {
    // A quick live game: topic, number of questions, time, class, Start.
    const { ctx, page } = await open(vp, 'teacher-quick')
    const topicsList = page.getByRole('list', { name: 'Topics' })
    const cards = topicsList.getByRole('button')
    await cards.nth(0).click()
    await page.locator('#grc-topic-settings').waitFor()
    const oneAll = Number((await page.getByRole('button', { name: /^All \d+$/ }).textContent()).match(/\d+/)[0])
    // Combine a second topic: one game from both, counts added up.
    await cards.nth(1).click()
    await page.getByText('2 topics combined').waitFor()
    if (!(await page.locator('#grc-topic-settings').textContent()).includes(' + ')) throw new Error('combined topics are not named "A + B"')
    const twoAll = Number((await page.getByRole('button', { name: /^All \d+$/ }).textContent()).match(/\d+/)[0])
    if (!(twoAll > oneAll)) throw new Error(`combining topics did not add their questions (${oneAll} -> ${twoAll})`)
    await page.getByRole('button', { name: /^All \d+$/ }).click()
    await page.getByRole('button', { name: '30s' }).click()
    await shot(page, vp, 'flow-teacher-quick')
    const assignHref = await page.getByRole('link', { name: 'Assign to classes' }).getAttribute('href')
    if (!/teacher\/assign\/topic\?topics=[^&]+,[^&]+&type=quiz&count=\d+&seconds=30/.test(assignHref)) throw new Error('unexpected assign link: ' + assignHref)
    // Starting opens the host screen; the harness has none, so serve a blank page there.
    await page.route('**/gr-classic/live/**', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>host</title>' }))
    // Two classes in the sample: starting without one asks for it.
    await page.getByRole('button', { name: 'Start live game' }).click()
    await page.getByText('Choose the class that is playing.').waitFor()
    await page.getByRole('group', { name: 'Class playing' }).getByRole('button').first().click()
    await page.getByRole('button', { name: 'Start live game' }).click()
    await page.waitForURL(/\/gr-classic\/live\/live-1/, { timeout: 5000 })
    const asked = JSON.parse(await page.evaluate(() => sessionStorage.getItem('grc-harness-topic-live')))
    if (!asked || asked.topics?.length !== 2 || asked.count !== twoAll) throw new Error('live game sent the wrong request: ' + JSON.stringify(asked))
    await ctx.close()
  })

  await flow('topic-untoggle', vp, async () => {
    // Tapping a chosen topic again takes it out of the game.
    const { ctx, page } = await open(vp, 'teacher-quick')
    const cards = page.getByRole('list', { name: 'Topics' }).getByRole('button')
    await cards.nth(0).click()
    await cards.nth(1).click()
    await page.getByText('2 topics combined').waitFor()
    await cards.nth(0).click()
    await page.getByText('Tap more topics above').waitFor()
    if ((await cards.nth(0).getAttribute('aria-pressed')) !== 'false') throw new Error('topic stayed selected')
    await cards.nth(1).click()
    if ((await page.locator('#grc-topic-settings').count()) > 0) throw new Error('settings still shown with no topic chosen')
    await ctx.close()
  })

  await flow('assign-topic', vp, async () => {
    // Assign a topic: the usual classes / due date form, then publish.
    const { ctx, page } = await open(vp, 'assign-topic')
    await page.getByRole('heading', { name: 'Assign a topic' }).waitFor()
    await page.getByText('picked at random from this topic when you publish').waitFor()
    await page.getByRole('button', { name: /Grade 2/ }).click()
    await shot(page, vp, 'flow-assign-topic')
    await page.getByRole('button', { name: /Publish Assignment/ }).click()
    await page.getByText('Assignment published!').waitFor()
    const sent = await page.evaluate(() => window.__topicAssigned)
    if (!sent || sent.type !== 'quiz' || sent.count !== 3 || !sent.topics?.length || !sent.classIds?.length || !sent.dueAt) throw new Error('topic assignment sent the wrong request: ' + JSON.stringify(sent))
    await ctx.close()
  })

  await flow('student-topics', vp, async () => {
    const { ctx, page } = await open(vp, 'student-topics')
    const topicsList = page.getByRole('list', { name: 'Topics' })
    await topicsList.getByRole('button').first().click()
    await page.getByRole('button', { name: '5', exact: true }).click().catch(() => {})
    await page.getByRole('button', { name: '20s' }).click()
    const href = await page.getByRole('link', { name: 'Start' }).getAttribute('href')
    if (!/practice\/topic\?topics=.+&type=quiz&count=\d+&seconds=20/.test(href)) throw new Error('unexpected start link: ' + href)
    // 'All' asks for every question in the topic (never 0).
    const allButton = page.getByRole('button', { name: /^All \d+$/ })
    await allButton.click()
    const allN = (await allButton.textContent()).match(/\d+/)[0]
    const allHref = await page.getByRole('link', { name: 'Start' }).getAttribute('href')
    if (!allHref.includes(`&count=${allN}&`)) throw new Error('All gives the wrong count: ' + allHref)
    await shot(page, vp, 'flow-student-topics')
    await ctx.close()
  })

  await flow('student-home', vp, async () => {
    // No more practice games: Play Offline, and the scores per topic.
    const { ctx, page } = await open(vp, 'student')
    if ((await page.getByText(/Practice games/i).count()) > 0) throw new Error('student home still shows Practice games')
    const offline = await page.getByRole('link', { name: /Play Offline/ }).getAttribute('href')
    if (!offline.endsWith('/gr-classic/student/topics')) throw new Error('Play Offline goes to ' + offline)
    const cards = page.getByRole('list', { name: 'Scores by topic' }).getByRole('listitem')
    if ((await cards.count()) !== 4) throw new Error('expected 4 topics on the dashboard')
    await page.getByText('Topics played').waitFor()
    await page.getByRole('progressbar').first().waitFor()
    await shot(page, vp, 'flow-student-home')
    await ctx.close()
    const empty = await open(vp, 'student&empty=1')
    await empty.page.getByText('and your scores will show here').waitFor()
    await empty.ctx.close()
  })

  await flow('topic-finish', vp, async () => {
    // Finishing a Play Offline game saves the score per question for the dashboard.
    const { ctx, page } = await open(vp, 'topic-practice&seconds=60')
    const total = Number((await page.getByText(/^\d+ \/ \d+$/).first().textContent()).split('/')[1])
    for (let i = 0; i < total; i++) {
      await page.getByRole('button', { name: /^Answer 1/ }).click()
      // A double tap on Next moves on once: no question is skipped or counted twice.
      const nextButton = page.getByRole('button', { name: /Next →|See my score/ })
      if (i === 0) await nextButton.dblclick()
      else await nextButton.click()
    }
    await page.getByRole('button', { name: 'Play again' }).waitFor()
    await page.waitForTimeout(400)
    const sent = await page.evaluate(() => window.__topicFinished)
    if (!sent || sent.results?.length !== total || sent.results.some((r) => !r.questionId || r.total !== 1 || ![0, 1].includes(r.correct))) throw new Error(`finish sent the wrong results (expected ${total}): ` + JSON.stringify(sent))
    await ctx.close()
  })

  await flow('topic-practice-timer', vp, async () => {
    // Time per question: answering in time scores; running out moves on.
    const { ctx, page } = await open(vp, 'topic-practice&seconds=10')
    await page.getByRole('timer').waitFor()
    await page.getByRole('button', { name: /^Answer 1/ }).click()
    await page.getByRole('button', { name: /Next →/ }).click()
    await page.getByText('Time’s up! ⏰').waitFor({ timeout: 13000 })
    await shot(page, vp, 'flow-topic-time-up')
    await page.getByRole('button', { name: /Next →|See my score/ }).click()
    // The next question starts with a fresh clock, not an expired one.
    await page.waitForTimeout(1500)
    if ((await page.getByText('Time’s up! ⏰').count()) > 0) throw new Error('the next question inherited the expired clock')
    await ctx.close()
  })

  await flow('create-save', vp, async () => {
    const { ctx, page } = await open(vp, 'create')
    await page.getByRole('button', { name: /Classic Quiz/ }).click()
    await page.getByLabel('Game name').fill('உயிர் எழுத்துக்கள் — வாரம் 1')
    await page.getByRole('checkbox').nth(0).check()
    await page.getByRole('checkbox').nth(2).check()
    if ((await page.locator('ol.space-y-2 > li').count()) !== 2) throw new Error('hand-picked questions were not added')
    // Questions are only picked from the library here, never written.
    if ((await page.getByText('Write a new question').count()) > 0) throw new Error('Create Game still offers to write a question')
    await shot(page, vp, 'flow-create-filled')
    await page.getByRole('button', { name: 'Save game' }).click()
    await page.getByText('Game saved!').waitFor()
    await shot(page, vp, 'flow-create-saved')
    await ctx.close()
  })

  await flow('duplicate', vp, async () => {
    const { ctx, page } = await open(vp, 'teacher')
    await page.getByRole('button', { name: 'Duplicate' }).first().click()
    await page.getByText('Made a copy').waitFor()
    await page.getByRole('button', { name: 'Archive' }).nth(1).click()
    await shot(page, vp, 'flow-teacher-duplicate')
    await ctx.close()
  })

  await flow('create', vp, async () => {
    const { ctx, page } = await open(vp, 'create')
    await page.getByRole('button', { name: /Classic Quiz/ }).click()
    await page.getByRole('checkbox').nth(0).check()
    await page.getByRole('checkbox').nth(1).check()
    await page.getByText('Advanced options').click()
    await shot(page, vp, 'flow-create-questions')
    await ctx.close()
  })

  await flow('quiz', vp, async () => {
    const { ctx, page } = await open(vp, 'quiz')
    await page.getByRole('button', { name: 'Answer 2: 12' }).click()
    await shot(page, vp, 'flow-quiz-correct')
    await page.getByRole('button', { name: 'Next →' }).click()
    await page.getByRole('button', { name: 'Answer 1: அ' }).click()
    await shot(page, vp, 'flow-quiz-wrong')
    await ctx.close()
  })

  await flow('match', vp, async () => {
    const { ctx, page } = await open(vp, 'match')
    await page.getByRole('button', { name: 'பூனை', exact: true }).click()
    await page.getByRole('button', { name: 'cat', exact: true }).click()
    await page.getByRole('button', { name: 'நாய்', exact: true }).click()
    await shot(page, vp, 'flow-match-selected')
    for (const [l, r] of [['நாய்', 'dog'], ['பசு', 'cow'], ['யானை', 'elephant']]) {
      if (l !== 'நாய்') await page.getByRole('button', { name: l, exact: true }).click()
      await page.getByRole('button', { name: r, exact: true }).click()
    }
    await page.waitForTimeout(400)
    await shot(page, vp, 'flow-match-done')
    await ctx.close()
  })

  await flow('word', vp, async () => {
    const { ctx, page } = await open(vp, 'word')
    for (const t of ['ம்', 'அ', 'மா']) await page.getByRole('button', { name: `Tile ${t}`, exact: true }).click()
    await page.getByRole('button', { name: 'Check ✓' }).click()
    await page.waitForTimeout(500)
    await shot(page, vp, 'flow-word-wrong')
    await page.getByRole('button', { name: 'Clear' }).click()
    for (const t of ['அ', 'ம்', 'மா']) await page.getByRole('button', { name: `Tile ${t}`, exact: true }).click()
    await page.getByRole('button', { name: 'Check ✓' }).click()
    await page.waitForTimeout(300)
    await shot(page, vp, 'flow-word-correct')
    await ctx.close()
  })

  await flow('assignment', vp, async () => {
    const { ctx, page } = await open(vp, 'assignment-quiz')
    for (let i = 0; i < 5; i++) {
      await page.getByRole('button', { name: /^Answer 1:/ }).click()
      if (i === 0) await shot(page, vp, 'flow-assignment-saved')
      await page.getByRole('button', { name: i < 4 ? 'Next →' : 'Finish' }).click()
    }
    await shot(page, vp, 'flow-assignment-confirm')
    await page.getByRole('button', { name: 'Finish & Submit' }).click()
    await page.getByText('Assignment Submitted Successfully!').waitFor()
    await page.waitForTimeout(1800)
    await shot(page, vp, 'flow-assignment-submitted')
    await ctx.close()
  })

  await flow('results', vp, async () => {
    const { ctx, page } = await open(vp, 'results')
    await page.getByRole('button', { name: 'View' }).first().click()
    await shot(page, vp, 'flow-results-view')
    await ctx.close()
  })

  await flow('live-student-quiz', vp, async () => {
    const { ctx, page } = await open(vp, 'join&auto=1')
    await page.getByLabel('Game PIN').fill('111111')
    await page.getByRole('button', { name: 'Join ▶' }).click()
    await page.getByText('couldn’t find a live game').waitFor()
    await shot(page, vp, 'flow-live-bad-pin')
    await page.getByLabel('Game PIN').fill('482913')
    await page.getByRole('button', { name: 'Join ▶' }).click()
    await page.getByText('You’re in, Kavin!').waitFor()
    await shot(page, vp, 'flow-live-lobby-phone')
    await page.getByRole('button', { name: 'Answer 2: 12' }).waitFor({ timeout: 15000 })
    await shot(page, vp, 'flow-live-question-phone')
    await page.getByRole('button', { name: 'Answer 2: 12' }).click()
    await page.getByText('Answer locked in!').waitFor()
    await shot(page, vp, 'flow-live-locked-phone')
    await page.getByText('சரி! Correct!').waitFor({ timeout: 15000 })
    await shot(page, vp, 'flow-live-reveal-phone')
    await page.getByText('You’re number').waitFor({ timeout: 10000 })
    // Students see the whole class leaderboard, their own row marked.
    await page.getByRole('region', { name: 'Leaderboard' }).getByText('Kavin (you)').waitFor()
    if ((await page.getByRole('region', { name: 'Leaderboard' }).locator('li').count()) < 3) throw new Error('phone leaderboard does not list the class')
    await shot(page, vp, 'flow-live-leaderboard-phone')
    await ctx.close()
  })

  await flow('live-wrong-account', vp, async () => {
    // Another student signs in on this browser mid-game: the tab must stop,
    // not carry on under their name.
    const { ctx, page } = await open(vp, 'join&auto=1&switch=1&pin=482913')
    await page.getByText('You’re in, Kavin!').waitFor()
    await page.getByText('Someone else signed in').waitFor({ timeout: 15000 })
    if ((await page.getByRole('button', { name: /^Answer \d/ }).count()) > 0) throw new Error('answer buttons still showing for the wrong account')
    await shot(page, vp, 'flow-live-wrong-account')
    await ctx.close()
  })

  await flow('live-student-race', vp, async () => {
    const { ctx, page } = await open(vp, 'join&auto=1&game=g-porul-match&pin=482913')
    await page.getByText('Tap one card, then its partner.').waitFor({ timeout: 15000 })
    for (const [l, r] of [['பூனை', 'cat'], ['நாய்', 'dog'], ['பசு', 'cow'], ['யானை', 'elephant']]) {
      await page.getByRole('button', { name: l, exact: true }).click()
      await page.getByRole('button', { name: r, exact: true }).click()
      await page.waitForTimeout(200)
    }
    await page.getByText('2 / 2').waitFor({ timeout: 5000 })
    await shot(page, vp, 'flow-live-race-phone')
    await ctx.close()
  })

  if (!vp.name.startsWith('phone')) {
    await flow('live-host', vp, async () => {
      const { ctx, page } = await open(vp, 'host')
      await page.waitForTimeout(3500)
      await shot(page, vp, 'flow-host-lobby')
      await page.getByRole('button', { name: 'Start game ▶' }).click()
      await page.getByRole('timer').waitFor()
      await page.waitForTimeout(2500)
      await shot(page, vp, 'flow-host-question')
      // Auto-play: revealed when everyone has answered or time is up, then
      // the leaderboard and the next question follow with no clicks.
      await page.getByRole('button', { name: /Leaderboard in \d/ }).waitFor({ timeout: 15000 })
      await page.waitForTimeout(600)
      await shot(page, vp, 'flow-host-reveal')
      await page.getByRole('heading', { name: 'Leaderboard' }).waitFor({ timeout: 8000 })
      await page.getByRole('button', { name: /Next question in \d/ }).waitFor()
      await page.waitForTimeout(400)
      await shot(page, vp, 'flow-host-leaderboard')
      await page.getByText('2 / 5').waitFor({ timeout: 9000 })
      // Paused: the teacher moves on by hand again.
      await page.getByRole('button', { name: 'Pause' }).click()
      await page.getByRole('button', { name: /Stop timer/ }).click()
      await page.getByRole('button', { name: 'Next ▶' }).click()
      for (let i = 2; i < 5; i++) {
        await page.getByRole('button', { name: 'Next question ▶' }).click()
        await page.getByRole('button', { name: /Stop timer/ }).click()
        await page.getByRole('button', { name: 'Next ▶' }).click()
      }
      await page.getByRole('button', { name: /Show winners/ }).click()
      await page.waitForTimeout(2200)
      await shot(page, vp, 'flow-host-podium')
      await page.getByRole('button', { name: 'Play again' }).click()
      await page.getByRole('button', { name: 'Start game ▶' }).waitFor()
      await ctx.close()
    })
    await flow('live-host-race', vp, async () => {
      const { ctx, page } = await open(vp, 'host&game=g-porul-match')
      await page.waitForTimeout(3000)
      await page.getByRole('button', { name: 'Start game ▶' }).click()
      await page.waitForTimeout(5000)
      await shot(page, vp, 'flow-host-race')
      await page.getByRole('button', { name: /End game & show winners/ }).click()
      await page.waitForTimeout(1500)
      await shot(page, vp, 'flow-host-race-podium')
      await ctx.close()
    })
  }
  console.log(`done ${vp.name}`)
}

// Reduced motion: finishing a game with a top score shows no confetti.
{
  const vp = { name: 'reduced-motion' }
  await flow('reduced-motion', vp, async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
    const page = await ctx.newPage()
    await page.goto(`${base}?screen=quiz`)
    const answers = ['Answer 2: 12', 'Answer 3: ஊ', 'Answer 3: உ', 'Answer 1: அ', 'Answer 2: நெடில்']
    for (let i = 0; i < answers.length; i++) {
      await page.getByRole('button', { name: answers[i] }).click()
      await page.getByRole('button', { name: i < 4 ? 'Next →' : 'See my score' }).click()
    }
    await page.getByText('100%').waitFor()
    const pieces = await page.locator('div.pointer-events-none.fixed span').count()
    if (pieces !== 0) throw new Error(`${pieces} confetti pieces shown with reduced motion`)
    await ctx.close()
  })
}

writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
await browser.close()
server.close()
