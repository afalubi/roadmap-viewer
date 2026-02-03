import { NextResponse, type NextRequest } from 'next/server';
import { ensureRoadmapsSchema } from '@/lib/roadmapsDb';
import { getAuthUser } from '@/lib/usersAccess';
import { getRoadmapRoleForUser, hasRoadmapRoleAtLeast } from '@/lib/roadmapsAccess';
import { fetchAzureDevopsWorkItemRelatedItems } from '@/lib/roadmapDatasourceServer';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string; itemId: string }> },
) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, itemId } = await context.params;
  await ensureRoadmapsSchema();

  const role = await getRoadmapRoleForUser(authUser.id, id);
  if (!hasRoadmapRoleAtLeast(role, 'editor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!itemId) {
    return NextResponse.json({ error: 'Invalid work item id' }, { status: 400 });
  }

  try {
    const related = await fetchAzureDevopsWorkItemRelatedItems(id, itemId);
    return NextResponse.json({ related });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to load related items.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
