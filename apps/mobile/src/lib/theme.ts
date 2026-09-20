/** Web'deki tasarım tokenlerinin RN karşılığı (oklch → yaklaşık hex). Tek yer. */
export const c = {
  ink: '#25262F',
  inkSoft: '#6B6D78',
  paper: '#FCFCFB',
  paper2: '#F3F3F1',
  line: '#E1E1E6',
  accent: '#4F46E5',
  accentSoft: '#EEF0FC',
  verified: '#2E8B57',
  documented: '#2F80C2',
  referenced: '#D97A1F',
  declared: '#8A8B94',
  red: '#DC2626',
} as const;

export const LEVEL = {
  verified: { label: 'Doğrulanmış', color: c.verified },
  documented: { label: 'Belgeli', color: c.documented },
  referenced: { label: 'Referanslı', color: c.referenced },
  declared: { label: 'Beyan', color: c.declared },
} as const;
