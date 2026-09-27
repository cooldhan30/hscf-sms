// Tamil Grand Prix tracks -- typed data only (no drawing, no React).
// Each track is a lap of road SECTIONS (length in road segments, curve
// strength, hill height), roadside SCENERY spans, a few LANDMARKS, and a
// THEME (sky, ground, road colours, horizon silhouette, night lights).
// lib/gameRoomV2/racing3d/road.ts turns this into drawable segments.
//
// Original environments inspired by Tamil Nadu places; no real game's
// track is reproduced.

export type SceneryKind =
  | 'palm'
  | 'tree'
  | 'banyan'
  | 'pine'
  | 'bamboo'
  | 'bush'
  | 'rock'
  | 'building'
  | 'tallBuilding'
  | 'shop'
  | 'streetlamp'
  | 'neon'
  | 'billboard'
  | 'hut'
  | 'haystack'
  | 'paddy'
  | 'gopuram'
  | 'mandapam'
  | 'flag'
  | 'lighthouse'
  | 'boat'
  | 'waveRock'
  | 'waterfall'
  | 'fence'
  | 'crowd'
  | 'lantern'
  | 'sign'
  | 'house'
  | 'teaStall'
  | 'busStop'
  | 'chevron'

export type Horizon = 'city' | 'mountains' | 'sea' | 'forest' | 'fields' | 'nightCity'
export type MusicStyle = 'city' | 'temple' | 'coast' | 'forest' | 'village' | 'night'
export type Ambience = 'city' | 'temple' | 'waves' | 'forest' | 'village' | 'nightCity'

export interface TrackSection {
  // Road segments in this section (eased in/out over its first/last quarter).
  len: number
  // Curve strength: -6 (hard left) .. 6 (hard right); 0 straight.
  curve: number
  // Height change over the section in segment heights (+ up, - down).
  hill: number
}

export interface ScenerySpan {
  // Fractions of the lap (0..1).
  from: number
  to: number
  kinds: SceneryKind[]
  // Chance per segment (0..1) of placing a piece.
  density: number
  side: 'both' | 'left' | 'right'
}

export interface Landmark {
  at: number // fraction of the lap
  kind: SceneryKind
  side: -1 | 1
  // Distance from the road centre in road half-widths (>1 is off-road).
  offset: number
  scale?: number
}

export interface TrackTheme {
  sky: [string, string] // top, horizon
  fog: string
  sun?: { color: string; y: number } // y: 0 top .. 1 horizon
  moon?: boolean
  stars?: boolean
  horizon: Horizon
  horizonColor: [string, string] // far, near silhouettes
  grass: [string, string]
  rumble: [string, string]
  road: [string, string]
  lane: string
  // Neon-edged road and glowing lamps.
  night?: boolean
  // Sea to one side of the road (drawn beyond the verge).
  seaSide?: -1 | 1
  seaColor?: string
}

export interface TrackDef {
  id: string
  tamilName: string
  name: string
  blurb: string // Tamil
  blurbEn: string
  // 1 (gentle) .. 3 (technical): shown as a hint, not a lock.
  challenge: 1 | 2 | 3
  sections: TrackSection[]
  scenery: ScenerySpan[]
  landmarks: Landmark[]
  theme: TrackTheme
  music: MusicStyle
  ambience: Ambience
  // Roadside kinds that stop a car dead if it drives into them.
}

// Pieces that are solid when a car leaves the road and hits them.
export const SOLID_SCENERY: ReadonlySet<SceneryKind> = new Set<SceneryKind>([
  'palm', 'tree', 'banyan', 'pine', 'bamboo', 'rock', 'building', 'tallBuilding', 'shop', 'streetlamp', 'neon', 'billboard', 'hut', 'haystack', 'gopuram', 'mandapam', 'lighthouse', 'waveRock', 'fence', 'lantern', 'sign',
  'house', 'teaStall', 'busStop',
])

// Pieces drawn as solid blocks with a side wall facing the road (their
// depth along the road, in segments); everything else is a flat cut-out.
export const BOX_DEPTH: Partial<Record<SceneryKind, number>> = {
  building: 6, tallBuilding: 6, shop: 4, house: 4, mandapam: 5, hut: 3,
}

// Half-width of each piece in road half-widths (for collisions and drawing).
export const SCENERY_WIDTH: Record<SceneryKind, number> = {
  palm: 0.14, tree: 0.3, banyan: 0.5, pine: 0.2, bamboo: 0.12, bush: 0.22, rock: 0.3, building: 0.85, tallBuilding: 0.7, shop: 0.6,
  streetlamp: 0.05, neon: 0.35, billboard: 0.45, hut: 0.55, haystack: 0.3, paddy: 0.7, gopuram: 1.1, mandapam: 0.9, flag: 0.05,
  lighthouse: 0.35, boat: 0.5, waveRock: 0.4, waterfall: 1.2, fence: 0.5, crowd: 0.8, lantern: 0.05, sign: 0.2,
  house: 0.6, teaStall: 0.45, busStop: 0.4, chevron: 0.12,
}

const s = (len: number, curve: number, hill = 0): TrackSection => ({ len, curve, hill })

export const TRACKS: TrackDef[] = [
  {
    id: 'chennai-city',
    tamilName: 'சென்னை நகர ஓட்டம்',
    name: 'Chennai City Run',
    blurb: 'பரபரப்பான நகரத் தெருக்கள், கூர்மையான திருப்பங்கள், கடைகளும் விளம்பரப் பலகைகளும்.',
    blurbEn: 'Busy city streets, sharp corners, shops and billboards.',
    challenge: 2,
    sections: [
      s(90, 0), s(70, 3.5), s(120, 0), s(60, -4), s(80, 0, 6), s(90, 4, -6), s(140, 0), s(70, -3.5), s(60, 3.5), s(120, 0),
      s(100, -2.5, 8), s(100, 0, -8), s(80, 4.5), s(150, 0), s(70, -4), s(90, 0),
    ],
    scenery: [
      { from: 0, to: 1, kinds: ['building', 'tallBuilding', 'shop', 'shop', 'house'], density: 0.5, side: 'both' },
      { from: 0, to: 1, kinds: ['streetlamp'], density: 0.18, side: 'both' },
      { from: 0, to: 1, kinds: ['tree', 'teaStall', 'busStop', 'bush'], density: 0.12, side: 'both' },
      { from: 0.2, to: 0.45, kinds: ['billboard', 'sign'], density: 0.08, side: 'both' },
      { from: 0.6, to: 0.9, kinds: ['billboard', 'tree'], density: 0.1, side: 'both' },
    ],
    landmarks: [
      { at: 0.02, kind: 'crowd', side: -1, offset: 1.6 },
      { at: 0.02, kind: 'crowd', side: 1, offset: 1.6 },
      { at: 0.33, kind: 'gopuram', side: 1, offset: 3.4, scale: 1.3 },
      { at: 0.71, kind: 'tallBuilding', side: -1, offset: 2.4, scale: 1.5 },
    ],
    theme: {
      sky: ['#60a5fa', '#fde6c4'], fog: '#f3dcc0', sun: { color: '#fff4c2', y: 0.55 }, horizon: 'city', horizonColor: ['#b8a7a0', '#8f7d77'],
      grass: ['#9ca3af', '#8b929e'], rumble: ['#dc2626', '#f5f5f4'], road: ['#57534e', '#524e49'], lane: '#fafaf9',
    },
    music: 'city',
    ambience: 'city',
  },
  {
    id: 'temple-hill',
    tamilName: 'கோவில் மலைப்பாதை',
    name: 'Temple Mountain Road',
    blurb: 'மலை மேல் ஏறி இறங்கும் வளைவுப் பாதை; உச்சியில் கோபுரம் காத்திருக்கிறது.',
    blurbEn: 'A winding climb and plunge past hilltop temple towers.',
    challenge: 3,
    sections: [
      s(80, 0), s(100, 2, 25), s(80, -4.5, 20), s(80, 4.5, 15), s(60, 0, 10), s(90, -5, 0), s(80, 5, -20), s(120, 0, -35), s(70, 3),
      s(90, -3, 20), s(60, 4, 15), s(80, -4, -10), s(110, 0, -25), s(90, 2.5), s(80, 0),
    ],
    scenery: [
      { from: 0, to: 1, kinds: ['rock', 'pine', 'bush', 'tree'], density: 0.35, side: 'both' },
      { from: 0.25, to: 0.55, kinds: ['flag', 'lantern'], density: 0.12, side: 'both' },
      { from: 0.55, to: 1, kinds: ['pine', 'pine', 'rock'], density: 0.3, side: 'both' },
    ],
    landmarks: [
      { at: 0.3, kind: 'gopuram', side: -1, offset: 2.6, scale: 1.6 },
      { at: 0.36, kind: 'mandapam', side: 1, offset: 2.3 },
      { at: 0.62, kind: 'gopuram', side: 1, offset: 4, scale: 2 },
      { at: 0.9, kind: 'mandapam', side: -1, offset: 2.4 },
    ],
    theme: {
      sky: ['#7dd3fc', '#e0f2fe'], fog: '#dbeafe', sun: { color: '#fffbeb', y: 0.35 }, horizon: 'mountains', horizonColor: ['#94a3b8', '#64748b'],
      grass: ['#65a30d', '#5b9a0c'], rumble: ['#b45309', '#fef3c7'], road: ['#6b6258', '#655c53'], lane: '#fef3c7',
    },
    music: 'temple',
    ambience: 'temple',
  },
  {
    id: 'coastal-highway',
    tamilName: 'கடற்கரை விரைவு',
    name: 'Coastal Highway',
    blurb: 'கடலோர நெடுஞ்சாலை: நீண்ட வேக வளைவுகள், தென்னை மரங்கள், கலங்கரை விளக்கம்.',
    blurbEn: 'Long, fast sweeping bends by the sea -- palms and a lighthouse.',
    challenge: 1,
    sections: [
      s(120, 0), s(160, 2), s(120, 0, 8), s(180, -2.5, -8), s(140, 0), s(160, 1.5, 12), s(120, -1.5, -12), s(160, 0), s(140, 2.5), s(120, 0),
    ],
    scenery: [
      { from: 0, to: 1, kinds: ['palm', 'palm', 'bush'], density: 0.4, side: 'left' },
      { from: 0, to: 1, kinds: ['boat', 'waveRock'], density: 0.05, side: 'right' },
      { from: 0.4, to: 0.6, kinds: ['hut', 'palm', 'teaStall'], density: 0.2, side: 'left' },
    ],
    landmarks: [
      { at: 0.18, kind: 'lighthouse', side: 1, offset: 3.2, scale: 1.4 },
      { at: 0.55, kind: 'boat', side: 1, offset: 2.4 },
      { at: 0.8, kind: 'lighthouse', side: -1, offset: 3.5, scale: 1.2 },
    ],
    theme: {
      sky: ['#38bdf8', '#e0f2fe'], fog: '#e0f2fe', sun: { color: '#fffde7', y: 0.25 }, horizon: 'sea', horizonColor: ['#7dd3fc', '#0ea5e9'],
      grass: ['#fde68a', '#fcd34d'], rumble: ['#0284c7', '#f8fafc'], road: ['#64748b', '#5f6f84'], lane: '#f8fafc', seaSide: 1, seaColor: '#0ea5e9',
    },
    music: 'coast',
    ambience: 'waves',
  },
  {
    id: 'forest-road',
    tamilName: 'காட்டு சாலை',
    name: 'Forest Route',
    blurb: 'அடர்ந்த காட்டுக்குள் இறுக்கமான S-வளைவுகள், மூங்கில் தோப்பு, அருவி.',
    blurbEn: 'Tight S-bends through dense forest, bamboo groves and a waterfall.',
    challenge: 3,
    sections: [
      s(70, 0), s(60, 4.5, 8), s(60, -4.5, 8), s(60, 4.5, -8), s(90, 0, -10), s(70, -5), s(70, 5, 12), s(110, 0, 12), s(60, -4), s(60, 4),
      s(60, -4, -15), s(100, 0, -15), s(80, 3), s(70, -3, 10), s(90, 0, -10),
    ],
    scenery: [
      { from: 0, to: 1, kinds: ['tree', 'tree', 'banyan', 'bush', 'bamboo'], density: 0.6, side: 'both' },
      { from: 0.3, to: 0.5, kinds: ['bamboo', 'bamboo'], density: 0.5, side: 'both' },
      { from: 0.7, to: 0.9, kinds: ['rock', 'tree'], density: 0.35, side: 'both' },
    ],
    landmarks: [
      { at: 0.46, kind: 'waterfall', side: -1, offset: 3.2, scale: 1.5 },
      { at: 0.75, kind: 'banyan', side: 1, offset: 2.2, scale: 1.6 },
    ],
    theme: {
      sky: ['#86efac', '#dcfce7'], fog: '#bbf7d0', horizon: 'forest', horizonColor: ['#4d7c0f', '#365314'],
      grass: ['#15803d', '#166534'], rumble: ['#78350f', '#fde68a'], road: ['#57534e', '#504c47'], lane: '#fde68a',
    },
    music: 'forest',
    ambience: 'forest',
  },
  {
    id: 'village-lane',
    tamilName: 'கிராமப் பாதை',
    name: 'Village Countryside',
    blurb: 'நெல் வயல்கள், தென்னந்தோப்பு, குடிசைகள் -- மாலைச் சூரியனில் கிராமச் சாலை.',
    blurbEn: 'Paddy fields, coconut groves and huts under an evening sun.',
    challenge: 1,
    sections: [
      s(110, 0), s(120, -2), s(100, 0, 6), s(90, 3, -6), s(130, 0), s(110, -3), s(90, 2, 5), s(130, 0, -5), s(100, -2), s(120, 1.5), s(90, 0),
    ],
    scenery: [
      { from: 0, to: 1, kinds: ['paddy', 'paddy', 'palm', 'haystack'], density: 0.35, side: 'both' },
      { from: 0.2, to: 0.35, kinds: ['hut', 'hut', 'palm', 'house'], density: 0.35, side: 'both' },
      { from: 0.4, to: 0.5, kinds: ['house', 'teaStall', 'palm'], density: 0.25, side: 'both' },
      { from: 0.6, to: 0.75, kinds: ['hut', 'banyan', 'haystack'], density: 0.3, side: 'both' },
      { from: 0, to: 1, kinds: ['fence'], density: 0.05, side: 'both' },
    ],
    landmarks: [
      { at: 0.28, kind: 'banyan', side: 1, offset: 2.4, scale: 1.7 },
      { at: 0.5, kind: 'mandapam', side: -1, offset: 2.6 },
      { at: 0.86, kind: 'gopuram', side: 1, offset: 5, scale: 1.2 },
    ],
    theme: {
      sky: ['#fb923c', '#fde68a'], fog: '#fcd9a8', sun: { color: '#fff1c1', y: 0.8 }, horizon: 'fields', horizonColor: ['#a3a36b', '#6b8e23'],
      grass: ['#84cc16', '#77bb14'], rumble: ['#a16207', '#fef9c3'], road: ['#8b7355', '#836c50'], lane: '#fef9c3',
    },
    music: 'village',
    ambience: 'village',
  },
  {
    id: 'night-city',
    tamilName: 'இரவு நகரம்',
    name: 'Night City Circuit',
    blurb: 'ஒளிரும் நியான் விளக்குகள், நீண்ட நேர்ச் சாலைகள், திடீர் திருப்பங்கள்.',
    blurbEn: 'Glowing neon, long straights and sudden chicanes.',
    challenge: 2,
    sections: [
      s(160, 0), s(50, 5), s(50, -5), s(180, 0), s(90, -3, 10), s(90, 0, -10), s(50, -5), s(50, 5), s(200, 0), s(100, 3.5), s(60, -4.5), s(130, 0),
    ],
    scenery: [
      { from: 0, to: 1, kinds: ['tallBuilding', 'building', 'neon'], density: 0.45, side: 'both' },
      { from: 0, to: 1, kinds: ['streetlamp'], density: 0.25, side: 'both' },
      { from: 0.3, to: 0.7, kinds: ['neon', 'billboard'], density: 0.15, side: 'both' },
      { from: 0, to: 1, kinds: ['shop', 'teaStall', 'busStop'], density: 0.1, side: 'both' },
    ],
    landmarks: [
      { at: 0.02, kind: 'crowd', side: -1, offset: 1.6 },
      { at: 0.02, kind: 'crowd', side: 1, offset: 1.6 },
      { at: 0.45, kind: 'tallBuilding', side: 1, offset: 2.4, scale: 1.8 },
      { at: 0.78, kind: 'gopuram', side: -1, offset: 3.6, scale: 1.4 },
    ],
    theme: {
      sky: ['#0b1026', '#312e81'], fog: '#1e1b4b', moon: true, stars: true, horizon: 'nightCity', horizonColor: ['#1e1b4b', '#111827'],
      grass: ['#1f2937', '#1a2230'], rumble: ['#db2777', '#22d3ee'], road: ['#27272a', '#232326'], lane: '#fde047', night: true,
    },
    music: 'night',
    ambience: 'nightCity',
  },
]

export type TrackId = (typeof TRACKS)[number]['id']

export function getTrack(id: string): TrackDef {
  return TRACKS.find((t) => t.id === id) ?? TRACKS[0]
}
