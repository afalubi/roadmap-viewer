import { NextResponse, type NextRequest } from 'next/server';
import { ensureRoadmapsSchema } from '@/lib/roadmapsDb';
import { getRoadmapRoleForUser, hasRoadmapRoleAtLeast } from '@/lib/roadmapsAccess';
import {
  getDatasourceRecord,
  resolveAzureDevopsWorkItem,
} from '@/lib/roadmapDatasourceServer';
import { decryptSecret } from '@/lib/secretStore';
import { getAuthUser } from '@/lib/usersAccess';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const body = (await request.json()) as { url?: string; pat?: string };

  await ensureRoadmapsSchema();
  const role = await getRoadmapRoleForUser(authUser.id, id);
  if (!hasRoadmapRoleAtLeast(role, 'owner')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const record = await getDatasourceRecord(id);
    const storedPat =
      !body.pat && record?.secret_encrypted
        ? decryptSecret(record.secret_encrypted)
        : null;
    const result = await resolveAzureDevopsWorkItem(
      body.url ?? '',
      body.pat ?? storedPat,
    );
    return NextResponse.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to parse work item URL.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
