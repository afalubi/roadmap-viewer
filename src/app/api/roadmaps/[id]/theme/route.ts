import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { sql } from '@/lib/neon';
import { ensureRoadmapsSchema } from '@/lib/roadmapsDb';
import { getRoadmapRole, hasRoadmapRoleAtLeast } from '@/lib/roadmapsAccess';
import { isThemeOption } from '@/lib/themeOptions';
import type { RoadmapThemeConfig, ThemeOverrides } from '@/types/theme';

const parseThemeConfig = (
  value?: string | null,
): RoadmapThemeConfig | null => {
  if (!value) return null;
  try {
    return JSON.parse(value) as RoadmapThemeConfig;
  } catch {
    return null;
  }
};

const normalizePalette = (
  values: Array<string | null | undefined> | undefined,
) => {
  if (!values) return undefined;
  const normalized = values.map((value) => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  });
  return normalized.some((value) => value) ? normalized : undefined;
};

const normalizeOverrides = (overrides?: ThemeOverrides | null) => {
  if (!overrides) return undefined;
  const item = normalizePalette(overrides.item);
  const lane = normalizePalette(overrides.lane);
  const header = normalizePalette(overrides.header);
  if (!item && !lane && !header) return undefined;
  return {
    ...(item ? { item } : {}),
    ...(lane ? { lane } : {}),
    ...(header ? { header } : {}),
  };
};

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await context.params;
  await ensureRoadmapsSchema();

  const role = await getRoadmapRole(userId, id);
  if (!hasRoadmapRoleAtLeast(role, 'viewer')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const rows = await sql`
    SELECT theme_json
    FROM roadmaps
    WHERE id = ${id}
    LIMIT 1
  `;
  const row = rows[0] as { theme_json?: string | null } | undefined;
  if (!row) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ themeConfig: parseThemeConfig(row.theme_json) });
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await context.params;
  const body = (await request.json()) as {
    themeConfig?: RoadmapThemeConfig | null;
  };
  const themeConfig = body.themeConfig ?? null;

  if (themeConfig && !isThemeOption(themeConfig.baseTheme)) {
    return NextResponse.json({ error: 'Invalid theme option.' }, { status: 400 });
  }

  await ensureRoadmapsSchema();
  const role = await getRoadmapRole(userId, id);
  if (!hasRoadmapRoleAtLeast(role, 'editor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const normalizedOverrides = normalizeOverrides(themeConfig?.overrides ?? null);
  const normalizedConfig = themeConfig
    ? {
        baseTheme: themeConfig.baseTheme,
        ...(normalizedOverrides ? { overrides: normalizedOverrides } : {}),
      }
    : null;

  const now = new Date().toISOString();
  await sql`
    UPDATE roadmaps
    SET theme_json = ${normalizedConfig ? JSON.stringify(normalizedConfig) : null},
        updated_by = ${userId},
        updated_at = ${now}
    WHERE id = ${id}
  `;

  return NextResponse.json({ success: true, updatedAt: now });
}
