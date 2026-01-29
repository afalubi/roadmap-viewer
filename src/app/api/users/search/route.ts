import { NextResponse } from 'next/server';
import { searchDirectoryUsers } from '@/lib/userDirectory';
import { getAuthUser } from '@/lib/usersAccess';

const MIN_QUERY_LENGTH = 2;

export async function GET(request: Request) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get('q')?.trim() ?? '';

  if (query.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ users: [] });
  }

  const users = await searchDirectoryUsers(query);
  return NextResponse.json({ users });
}
