import DOMPurify from 'dompurify';
import { marked } from 'marked';

export function renderRoadmapDescription(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const hasHtml = /<[^>]+>/.test(trimmed);
  return hasHtml ? renderHtmlOrMarkdown(trimmed) : renderMarkdown(trimmed);
}

function renderMarkdown(value: string): string {
  const normalized = value.replace(/\r\n/g, '\n');
  const withLists = promoteColonLists(normalized);
  const deindented = withLists
    .replace(/^\s{1,3}([*-]\s+)/gm, '$1')
    .replace(/^\s{1,3}(\d+\.\s+)/gm, '$1');
  const raw = marked.parse(deindented, { breaks: true }) as string;
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: [
      'p',
      'br',
      'strong',
      'b',
      'em',
      'i',
      'u',
      'ul',
      'ol',
      'li',
      'a',
      'span',
      'div',
      'blockquote',
      'h1',
      'h2',
      'h3',
      'h4',
      'code',
      'pre',
      'hr',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  });
}

function renderHtmlOrMarkdown(value: string): string {
  const sanitized = sanitizeRichText(value);
  if (/<(ul|ol|li)\b/i.test(sanitized)) {
    return sanitized;
  }
  const textSource = sanitized
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/p\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return renderMarkdown(textSource);
}

function promoteColonLists(value: string): string {
  const lines = value.split('\n');
  const result: string[] = [];
  let promote = false;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const trimmed = line.trim();
    if (!trimmed) {
      promote = false;
      result.push(line);
      continue;
    }
    if (trimmed.endsWith(':')) {
      promote = true;
      result.push(line);
      continue;
    }
    if (promote && !/^([-*]|\d+\.)\s+/.test(trimmed)) {
      result.push(`${line.replace(/^\s+/, '').padStart(line.length, ' ')}- ${trimmed}`);
      continue;
    }
    result.push(line);
  }
  return result.join('\n');
}

function sanitizeRichText(value: string): string {
  return DOMPurify.sanitize(value, {
    ALLOWED_TAGS: [
      'p',
      'br',
      'strong',
      'b',
      'em',
      'i',
      'u',
      'ul',
      'ol',
      'li',
      'a',
      'span',
      'div',
      'blockquote',
      'h1',
      'h2',
      'h3',
      'h4',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'style'],
  });
}
