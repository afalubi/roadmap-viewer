import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { ensureRoadmapsSchema } from '@/lib/roadmapsDb';
import { getRoadmapRole, hasRoadmapRoleAtLeast } from '@/lib/roadmapsAccess';
import type { RoadmapDatasourceType } from '@/types/roadmapDatasources';
import {
  getDatasourceRecord,
  sanitizeAzureConfig,
  validateAzureDevopsConfig,
} from '@/lib/roadmapDatasourceServer';
import { decryptSecret } from '@/lib/secretStore';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const body = (await request.json()) as {
    type?: RoadmapDatasourceType;
    config?: Record<string, unknown>;
    pat?: string;
  };

  await ensureRoadmapsSchema();
  const role = await getRoadmapRole(userId, id);
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
    await validateAzureDevopsConfig(
      sanitizeAzureConfig(body.config ?? {}),
      body.pat ?? storedPat,
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Validation failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
