import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/usersAccess';

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      idp: user.idp,
      externalId: user.externalId,
      email: user.email,
      displayName: user.displayName,
      roles: user.roles,
    },
  });
}
