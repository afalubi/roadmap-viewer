import 'server-only';
import { clerkClient } from '@clerk/nextjs/server';
import type { DirectoryUser } from '@/types/userDirectory';

type ClerkUser = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  primaryEmailAddress?: { emailAddress?: string | null } | null;
  emailAddresses?: Array<{ emailAddress?: string | null }>;
};

type SearchOptions = {
  limit?: number;
};

const DEFAULT_LIMIT = 8;

const buildDisplayName = (user: ClerkUser): string => {
  const name = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
  return name || user.username || user.primaryEmailAddress?.emailAddress || user.id;
};

const toDirectoryUser = (user: ClerkUser): DirectoryUser => {
  const email =
    user.primaryEmailAddress?.emailAddress ??
    user.emailAddresses?.[0]?.emailAddress ??
    null;
  return {
    id: user.id,
    displayName: buildDisplayName(user),
    email,
  };
};

const unwrapClerkList = (result: unknown): ClerkUser[] => {
  if (Array.isArray(result)) return result as ClerkUser[];
  if (result && typeof result === 'object' && 'data' in result) {
    const data = (result as { data?: ClerkUser[] }).data;
    return Array.isArray(data) ? data : [];
  }
  return [];
};

export async function searchDirectoryUsers(
  query: string,
  options: SearchOptions = {},
): Promise<DirectoryUser[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const client = await clerkClient();
  const limit = Math.max(1, options.limit ?? DEFAULT_LIMIT);
  const users: ClerkUser[] = [];

  if (trimmed.includes('@')) {
    try {
      const byEmail = await client.users.getUserList({
        emailAddress: [trimmed.toLowerCase()],
        limit: 1,
      });
      users.push(...unwrapClerkList(byEmail));
    } catch {
      // Ignore email lookup failures and fall back to query search.
    }
  }

  try {
    const byQuery = await client.users.getUserList({
      query: trimmed,
      limit,
    });
    users.push(...unwrapClerkList(byQuery));
  } catch {
    return users.slice(0, limit).map(toDirectoryUser);
  }

  const deduped = new Map<string, ClerkUser>();
  for (const user of users) {
    if (!deduped.has(user.id)) deduped.set(user.id, user);
  }

  return Array.from(deduped.values())
    .slice(0, limit)
    .map(toDirectoryUser);
}
