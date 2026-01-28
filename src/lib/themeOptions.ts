import type { ThemeOption } from '@/types/views';

export const THEME_OPTIONS: ThemeOption[] = [
  'executive',
  'coastal',
  'orchard',
  'sunset',
  'sand',
  'mono',
  'forest',
  'metro',
  'metro-dark',
];

export const isThemeOption = (value: string): value is ThemeOption =>
  THEME_OPTIONS.includes(value as ThemeOption);
