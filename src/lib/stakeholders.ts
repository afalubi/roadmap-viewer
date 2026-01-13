const SEPARATOR_REGEX = /[;,|]/;

export function parseStakeholders(value: string): string[] {
  if (!value) return [];
  return value
    .split(SEPARATOR_REGEX)
    .map((part) => part.trim())
    .filter(Boolean);
}
