const LIST_SEPARATOR_REGEX = /[;,|]/;

function normalizeTitleToken(value: string): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  const isAllCaps = /^[A-Z0-9]+$/.test(trimmed);
  if (isAllCaps && (trimmed.length <= 4 || /\d/.test(trimmed))) return trimmed;
  const lower = trimmed.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function normalizeTitleCase(value: string): string {
  if (!value) return '';
  return value
    .split(' ')
    .map((word) =>
      word
        .split('-')
        .map((part) => normalizeTitleToken(part))
        .join('-'),
    )
    .join(' ')
    .trim();
}

export function normalizeDelimitedList(
  value: string,
  normalizer: (entry: string) => string,
): string {
  if (!value) return '';
  const parts = value
    .split(LIST_SEPARATOR_REGEX)
    .map((part) => part.trim())
    .filter(Boolean);
  const normalized = parts.map((part) => normalizer(part)).filter(Boolean);
  return normalized.join('; ');
}

export function normalizeRegionValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const upper = trimmed.toUpperCase();
  if (upper === 'US' || upper === 'USA') return 'US';
  return normalizeTitleCase(trimmed);
}

export function normalizeRegionList(value: string): string {
  return normalizeDelimitedList(value, normalizeRegionValue);
}

export function normalizeStakeholders(value: string): string {
  return normalizeDelimitedList(value, normalizeTitleCase);
}
