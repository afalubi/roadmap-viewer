export type Region = 'US' | 'Canada';

const REGION_ALIASES: Record<string, Region> = {
  us: 'US',
  usa: 'US',
  'united states': 'US',
  canada: 'Canada',
};

const REGION_ORDER: Region[] = ['US', 'Canada'];
type RegionFlagAsset = {
  region: Region;
  src: string;
  alt: string;
};

const REGION_FLAG_ASSETS: Record<Region, RegionFlagAsset> = {
  US: {
    region: 'US',
    src: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f1fa-1f1f8.svg',
    alt: 'United States flag',
  },
  Canada: {
    region: 'Canada',
    src: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f1e8-1f1e6.svg',
    alt: 'Canada flag',
  },
};

export function parseRegions(value: string): Region[] {
  if (!value) return [];
  const parts = value
    .split(/[;,|]/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);

  const normalized = parts
    .map((part) => REGION_ALIASES[part])
    .filter((region): region is Region => Boolean(region));

  return REGION_ORDER.filter((region) => normalized.includes(region));
}

export function getRegionFlagAssets(value: string): RegionFlagAsset[] {
  const regions = parseRegions(value);
  return regions.map((region) => REGION_FLAG_ASSETS[region]);
}
