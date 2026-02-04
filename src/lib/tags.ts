export function hasTag(value: string | null | undefined, tag: string): boolean {
  const normalizedTag = tag.trim().toLowerCase();
  if (!normalizedTag) return false;
  return (value ?? '')
    .split(/[;,]/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalizedTag);
}

export function getTagValueByPrefix(
  value: string | null | undefined,
  prefix: string,
): string | null {
  const normalizedPrefix = prefix.trim().toLowerCase();
  if (!normalizedPrefix) return null;
  const tags = (value ?? '')
    .split(/[;,]/)
    .map((part) => part.trim())
    .filter(Boolean);
  for (const tag of tags) {
    const lower = tag.toLowerCase();
    if (!lower.startsWith(normalizedPrefix)) continue;
    const remainder = tag.slice(normalizedPrefix.length).trim();
    if (!remainder) return null;
    return remainder;
  }
  return null;
}
