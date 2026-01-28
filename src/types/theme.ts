import type { ThemeOption } from '@/types/views';

export type ThemeOverridePalette = Array<string | null>;

export type ThemeOverrides = {
  item?: ThemeOverridePalette;
  lane?: ThemeOverridePalette;
  header?: ThemeOverridePalette;
};

export type RoadmapThemeConfig = {
  baseTheme: ThemeOption;
  overrides?: ThemeOverrides;
};
