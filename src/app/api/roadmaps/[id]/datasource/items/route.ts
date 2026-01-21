import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { ensureRoadmapsSchema } from '@/lib/roadmapsDb';
import { getRoadmapRole, hasRoadmapRoleAtLeast } from '@/lib/roadmapsAccess';
import { fetchDatasourceItems } from '@/lib/roadmapDatasourceServer';
import { buildCsvFromItems } from '@/lib/roadmapCsv';

export async function GET(
  request: NextRequest,
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

  const url = new URL(request.url);
  const forceRefresh = url.searchParams.get('refresh') === '1';
  const format = url.searchParams.get('format');

  try {
    const result = await fetchDatasourceItems(id, forceRefresh);
    if (format === 'csv') {
      const csv = buildCsvFromItems(result.items);
      return new NextResponse(csv, {
        headers: { 'Content-Type': 'text/csv; charset=utf-8' },
      });
    }
    return NextResponse.json({
      items: result.items,
      stale: result.stale,
      truncated: result.truncated,
      warning: result.warning ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load items';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
