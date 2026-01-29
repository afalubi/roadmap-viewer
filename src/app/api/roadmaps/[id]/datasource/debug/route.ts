import { NextResponse, type NextRequest } from 'next/server';
import { ensureRoadmapsSchema } from '@/lib/roadmapsDb';
import { getRoadmapRoleForUser, hasRoadmapRoleAtLeast } from '@/lib/roadmapsAccess';
import { fetchAzureDevopsDebugPayload } from '@/lib/roadmapDatasourceServer';
import { getAuthUser } from '@/lib/usersAccess';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  await ensureRoadmapsSchema();
  const role = await getRoadmapRoleForUser(authUser.id, id);
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
