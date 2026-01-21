import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { searchDirectoryUsers } from '@/lib/userDirectory';

const MIN_QUERY_LENGTH = 2;

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
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
