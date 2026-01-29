import { NextResponse, type NextRequest } from 'next/server';
import { ensureRoadmapsSchema } from '@/lib/roadmapsDb';
import { getRoadmapRoleForUser, hasRoadmapRoleAtLeast } from '@/lib/roadmapsAccess';
import {
  getDatasourceRecord,
  listAzureDevopsProjects,
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
  const body = (await request.json()) as { organizationUrl?: string; pat?: string };

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
    const projects = await listAzureDevopsProjects(
      body.organizationUrl ?? '',
      body.pat ?? storedPat,
    );
    return NextResponse.json({ projects });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Project lookup failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
