export function hasTag(value: string | null | undefined, tag: string): boolean {
  const normalizedTag = tag.trim().toLowerCase();
  if (!normalizedTag) return false;
  return (value ?? '')
    .split(/[;,]/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalizedTag);
}
