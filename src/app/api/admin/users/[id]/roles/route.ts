import { NextResponse, type NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/usersAccess';
import { updateUserRoles } from '@/lib/usersDb';

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!authUser.roles.isSystemAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await context.params;
  const body = (await request.json()) as {
    isSystemAdmin?: boolean;
    canCreateRoadmaps?: boolean;
  };

  await updateUserRoles(id, {
    isSystemAdmin:
      typeof body.isSystemAdmin === 'boolean' ? body.isSystemAdmin : undefined,
    canCreateRoadmaps:
      typeof body.canCreateRoadmaps === 'boolean'
        ? body.canCreateRoadmaps
        : undefined,
  });

  return NextResponse.json({ success: true });
}
