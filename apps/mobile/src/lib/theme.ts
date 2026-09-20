/**
 * Tasarım tokenlerinin RN karşılığı (docs/redesign/02-design-system.md, hex referans sütunu).
 * Web `@theme` ile aynı adlar; tek yer.
 */
export const c = {
  ink: '#20253D',
  inkSoft: '#5C6277',
  paper: '#F6F7FF',
  surface: '#FEFEFF',
  paper2: '#EEF0FF',
  line: '#DEE1F0',
  accent: '#5147D9',
  accentStrong: '#3D34B7',
  accentSoft: '#EEF0FF',
  verified: '#147A55',
  verifiedSoft: '#ECF8F2',
  documented: '#23669F',
  documentedSoft: '#EDF5FC',
  referenced: '#A55C17',
  referencedSoft: '#FCF3E6',
  declared: '#626979',
  declaredSoft: '#F3F4F7',
  negative: '#B64256',
  negativeSoft: '#FFF1F3',
  red: '#B64256',
} as const;

export const radius = { control: 10, panel: 16, feature: 24 } as const;

/** Hareket tokenleri (ms) — docs/redesign/03. Reduced motion açıkken süreler 0'a çekilir. */
export const motion = {
  instant: 90,
  quick: 160,
  standard: 240,
  emphasis: 360,
  page: 520,
  stagger: 55,
} as const;

export const LEVEL = {
  verified: { label: 'Doğrulanmış', color: c.verified, bg: c.verifiedSoft },
  documented: { label: 'Belgeli', color: c.documented, bg: c.documentedSoft },
  referenced: { label: 'Referanslı', color: c.referenced, bg: c.referencedSoft },
  declared: { label: 'Beyan', color: c.declared, bg: c.declaredSoft },
} as const;
