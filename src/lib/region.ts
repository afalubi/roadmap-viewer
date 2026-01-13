const REGION_ALIASES: Record<string, 'US' | 'Canada'> = {
  us: 'US',
  usa: 'US',
  'united states': 'US',
  canada: 'Canada',
};

const REGION_ORDER: Array<'US' | 'Canada'> = ['US', 'Canada'];
const REGION_EMOJIS: Record<'US' | 'Canada', string> = {
  US: '🇺🇸',
  Canada: '🇨🇦',
};

export function parseRegions(value: string): Array<'US' | 'Canada'> {
  if (!value) return [];
  const parts = value
    .split(/[;,|]/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);

  const normalized = parts
    .map((part) => REGION_ALIASES[part])
    .filter((region): region is 'US' | 'Canada' => Boolean(region));

  return REGION_ORDER.filter((region) => normalized.includes(region));
}

export function getRegionEmojiList(value: string): string[] {
  const regions = parseRegions(value);
  return regions.map((region) => REGION_EMOJIS[region]);
}

export function getRegionEmojis(value: string): string {
  return getRegionEmojiList(value).join(' ');
}
