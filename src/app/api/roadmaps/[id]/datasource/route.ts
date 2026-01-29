import { NextResponse, type NextRequest } from 'next/server';
import { ensureRoadmapsSchema } from '@/lib/roadmapsDb';
import { getRoadmapRoleForUser, hasRoadmapRoleAtLeast } from '@/lib/roadmapsAccess';
import { getAuthUser } from '@/lib/usersAccess';
import type { RoadmapDatasourceType } from '@/types/roadmapDatasources';
import {
  buildDatasourceSummary,
  ensureDatasourceRow,
  getDatasourceRecord,
  sanitizeAzureConfig,
  updateDatasourceRecord,
} from '@/lib/roadmapDatasourceServer';

export async function GET(
  _request: NextRequest,
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

  await ensureDatasourceRow(id);
  const record = await getDatasourceRecord(id);
  return NextResponse.json({ datasource: buildDatasourceSummary(record) });
}

export async function PUT(
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
    clearPat?: boolean;
  };

  await ensureRoadmapsSchema();
  const role = await getRoadmapRoleForUser(authUser.id, id);
  if (!hasRoadmapRoleAtLeast(role, 'owner')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const type = body.type === 'azure-devops' ? 'azure-devops' : 'csv';
  const config =
    type === 'azure-devops' ? sanitizeAzureConfig(body.config ?? {}) : {};
  const secret = type === 'csv' ? '' : body.clearPat ? '' : body.pat ?? null;

  try {
    await updateDatasourceRecord(id, type, config, secret);
    const record = await getDatasourceRecord(id);
    return NextResponse.json({ datasource: buildDatasourceSummary(record) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save datasource';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
