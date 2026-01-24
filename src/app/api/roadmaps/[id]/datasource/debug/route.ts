import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { ensureRoadmapsSchema } from '@/lib/roadmapsDb';
import { getRoadmapRole, hasRoadmapRoleAtLeast } from '@/lib/roadmapsAccess';
import { fetchAzureDevopsDebugPayload } from '@/lib/roadmapDatasourceServer';

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
  const sampleParam = Number(url.searchParams.get('sample') ?? '50');
  const sampleSize = Number.isFinite(sampleParam) ? Math.max(1, Math.min(200, sampleParam)) : 50;

  try {
    const payload = await fetchAzureDevopsDebugPayload(id, sampleSize);
    return NextResponse.json({ payload });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load payload';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
