// One-time import: seeds the Tamil Theni 2026 season, its 5 levels, its
// 20 categories, and ~800 words from supabase/seed-data/tamil-theni-2026-words.json
// into the database. Safe to re-run -- upserts on the natural unique
// keys (season name+year, category_number per season, category+
// difficulty+word_index per word) rather than blind inserts.
//
// Usage: node scripts/import-tamil-theni-2026.js
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const LEVELS = [
  { level_number: 1, name_tamil: 'அரும்பு', name_english: 'Bud', sort_order: 1 },
  { level_number: 2, name_tamil: 'மலர்கள்', name_english: 'Flowers', sort_order: 2 },
  { level_number: 3, name_tamil: 'கனிகள்', name_english: 'Fruits', sort_order: 3 },
  { level_number: 4, name_tamil: 'விதைகள்', name_english: 'Seeds', sort_order: 4 },
  { level_number: 5, name_tamil: 'செடிகள்', name_english: 'Plants', sort_order: 5 },
]

async function main() {
  const dataPath = path.join(__dirname, '..', 'supabase', 'seed-data', 'tamil-theni-2026-words.json')
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'))

  console.log(`Importing ${data.season.name}...`)

  const { data: existingSeason } = await admin
    .from('sms_theni_seasons')
    .select('id')
    .eq('year', data.season.year)
    .maybeSingle()

  let seasonId = existingSeason?.id
  if (!seasonId) {
    const { data: season, error } = await admin
      .from('sms_theni_seasons')
      .insert([{ name: data.season.name, year: data.season.year, is_active: true }])
      .select('id')
      .single()
    if (error) throw error
    seasonId = season.id
    console.log(`Created season ${seasonId}`)
  } else {
    console.log(`Season already exists: ${seasonId}`)
  }

  for (const level of LEVELS) {
    const { error } = await admin
      .from('sms_theni_levels')
      .upsert([{ season_id: seasonId, ...level }], { onConflict: 'season_id,level_number' })
    if (error) throw error
  }
  console.log(`Upserted ${LEVELS.length} levels`)

  const categoryIdByNumber = {}
  for (const cat of data.categories) {
    const { data: row, error } = await admin
      .from('sms_theni_categories')
      .upsert(
        [
          {
            season_id: seasonId,
            category_number: cat.categoryNumber,
            name_english: cat.nameEnglish,
            name_tamil: cat.nameTamil,
            icon: cat.icon,
            sort_order: cat.categoryNumber,
          },
        ],
        { onConflict: 'season_id,category_number' }
      )
      .select('id, category_number')
      .single()
    if (error) throw error
    categoryIdByNumber[cat.categoryNumber] = row.id
  }
  console.log(`Upserted ${data.categories.length} categories`)

  let wordCount = 0
  for (const [categoryNumberStr, difficulties] of Object.entries(data.words)) {
    const categoryId = categoryIdByNumber[Number(categoryNumberStr)]
    if (!categoryId) {
      console.warn(`No category found for number ${categoryNumberStr}, skipping its words`)
      continue
    }

    for (const [difficulty, pairs] of Object.entries(difficulties)) {
      const rows = pairs.map(([english, tamil], i) => ({
        season_id: seasonId,
        category_id: categoryId,
        difficulty,
        word_index: i + 1,
        english,
        tamil,
      }))

      const { error } = await admin
        .from('sms_theni_words')
        .upsert(rows, { onConflict: 'category_id,difficulty,word_index' })
      if (error) throw error
      wordCount += rows.length
    }
  }
  console.log(`Upserted ${wordCount} words`)
  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
