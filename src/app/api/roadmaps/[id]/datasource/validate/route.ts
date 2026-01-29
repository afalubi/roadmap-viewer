import { NextResponse, type NextRequest } from 'next/server';
import { ensureRoadmapsSchema } from '@/lib/roadmapsDb';
import { getRoadmapRoleForUser, hasRoadmapRoleAtLeast } from '@/lib/roadmapsAccess';
import type { RoadmapDatasourceType } from '@/types/roadmapDatasources';
import {
  getDatasourceRecord,
  sanitizeAzureConfig,
  validateAzureDevopsConfig,
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
  const body = (await request.json()) as {
    type?: RoadmapDatasourceType;
    config?: Record<string, unknown>;
    pat?: string;
  };

  await ensureRoadmapsSchema();
  const role = await getRoadmapRoleForUser(authUser.id, id);
  if (!hasRoadmapRoleAtLeast(role, 'owner')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const type = body.type === 'azure-devops' ? 'azure-devops' : 'csv';
  if (type !== 'azure-devops') {
    return NextResponse.json({ success: true });
  }

  try {
    const record = await getDatasourceRecord(id);
    const storedPat =
      !body.pat && record?.secret_encrypted
        ? decryptSecret(record.secret_encrypted)
        : null;
    const result = await validateAzureDevopsConfig(
      sanitizeAzureConfig(body.config ?? {}),
      body.pat ?? storedPat,
    );
    return NextResponse.json({
      success: true,
      warnings: result.warnings ?? [],
      missingFields: result.missingFields ?? [],
      missingFieldKeys: result.missingFieldKeys ?? [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Validation failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
